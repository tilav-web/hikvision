import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../entities/agent.entity';
import { DeviceEntity } from '../entities/device.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentsGateway } from './agents.gateway';

interface AgentRuntimeDevice {
  id: string;
  name?: string;
  mode: string;
  host: string;
  port: number;
  useHttps: boolean;
  online: boolean;
}

interface AgentDiscoveredDevice {
  serialNumber: string;
  macAddress: string | null;
  ipv4Address: string;
  httpPort: number;
  deviceType: string | null;
  deviceDescription: string | null;
  firmwareVersion: string | null;
  lastSeenAt: number;
}

export interface AgentDiscoveredResult {
  agentId: string;
  agentName: string;
  isOnline: boolean;
  /** SADP orqali topilgan, lekin DB'da hali qo'shilmagan qurilmalar */
  newDevices: AgentDiscoveredDevice[];
  /** SADP orqali topilgan va DB'da allaqachon mavjud bo'lganlari (serial bo'yicha) */
  knownDevices: Array<
    AgentDiscoveredDevice & { dbDeviceId: string; dbName: string }
  >;
  error?: string;
}

export interface AgentInspectResult {
  agentId: string;
  agentName: string;
  isOnline: boolean;
  expectedCount: number;
  actualCount: number;
  expected: Array<{ id: string; name: string; host: string; port: number; mode: string }>;
  actual: AgentRuntimeDevice[];
  missing: Array<{ id: string; name: string }>;
  extras: AgentRuntimeDevice[];
  error?: string;
}

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly repo: Repository<AgentEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    @Inject(forwardRef(() => AgentsGateway))
    private readonly gateway: AgentsGateway,
  ) {}

  /** super_admin barchasini, company_admin faqat o'z kampaniyasini ko'radi */
  async list(current: AuthUser, companyId?: string): Promise<AgentEntity[]> {
    const where: Record<string, any> = {};
    if (current.role === 'company_admin') {
      where.companyId = current.companyId!;
    } else if (companyId) {
      where.companyId = companyId;
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(current: AuthUser, id: string): Promise<AgentEntity> {
    const agent = await this.repo.findOne({ where: { id } });
    if (!agent) throw new NotFoundException('agent topilmadi');
    this.assertAccess(current, agent.companyId);
    return agent;
  }

  /**
   * Agent runtime holatini tekshirish.
   * Agent socketga 'inspect' yuboramiz va u qaytaradigan ro'yxatni
   * DB'dagi (kerakli) ro'yxat bilan solishtiramiz.
   */
  async inspect(current: AuthUser, id: string): Promise<AgentInspectResult> {
    const agent = await this.findOne(current, id);

    const dbDevices = await this.deviceRepo.find({ where: { agentId: id } });
    const expected = dbDevices.map((d) => ({
      id: d.id,
      name: d.name,
      host: d.host,
      port: d.port,
      mode: d.mode,
    }));

    const isOnline = this.gateway.isAgentOnline(id);
    if (!isOnline) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: false,
        expectedCount: expected.length,
        actualCount: 0,
        expected,
        actual: [],
        missing: expected.map((d) => ({ id: d.id, name: d.name })),
        extras: [],
        error: 'agent ulanmagan',
      };
    }

    try {
      const result = await this.gateway.sendAgentCommand<{
        devices: AgentRuntimeDevice[];
      }>(id, 'inspect', {});
      const actual = result.devices ?? [];
      const expectedIds = new Set(expected.map((d) => d.id));
      const actualIds = new Set(actual.map((d) => d.id));

      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: true,
        expectedCount: expected.length,
        actualCount: actual.length,
        expected,
        actual,
        missing: expected
          .filter((d) => !actualIds.has(d.id))
          .map((d) => ({ id: d.id, name: d.name })),
        extras: actual.filter((d) => !expectedIds.has(d.id)),
      };
    } catch (e) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: true,
        expectedCount: expected.length,
        actualCount: 0,
        expected,
        actual: [],
        missing: expected.map((d) => ({ id: d.id, name: d.name })),
        extras: [],
        error: (e as Error).message,
      };
    }
  }

  /**
   * Yangi agentni admin paneldan oldindan yaratish (qurilmalarni biriktirish uchun).
   * Agent qurilmasida AGENT_NAME shu yerdagi name bilan bir xil bo'lishi kerak.
   * Aks holda agent ulanganda avtomatik yangi yozuv yaratiladi (companyId, name).
   */
  async create(current: AuthUser, dto: CreateAgentDto): Promise<AgentEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId shart');
    }

    const existing = await this.repo.findOne({
      where: { companyId, name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `bu kampaniyada "${dto.name}" nomli agent allaqachon mavjud`,
      );
    }

    const entity = this.repo.create({
      companyId,
      name: dto.name.trim(),
      hostInfo: dto.hostInfo ?? null,
      isOnline: false,
      lastSeenAt: null,
    });
    return this.repo.save(entity);
  }

  /**
   * Agent SADP orqali topgan qurilmalar.
   * Server bularni DB'dagi (mavjud) qurilmalar bilan solishtirib qaytaradi.
   */
  async discovered(
    current: AuthUser,
    id: string,
  ): Promise<AgentDiscoveredResult> {
    const agent = await this.findOne(current, id);
    const isOnline = this.gateway.isAgentOnline(id);

    if (!isOnline) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: false,
        newDevices: [],
        knownDevices: [],
        error: 'agent ulanmagan',
      };
    }

    let raw: AgentDiscoveredDevice[] = [];
    try {
      const result = await this.gateway.sendAgentCommand<{
        devices: AgentDiscoveredDevice[];
      }>(id, 'discoverDevices', {}, 10_000);
      raw = result?.devices ?? [];
    } catch (e) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: true,
        newDevices: [],
        knownDevices: [],
        error: (e as Error).message,
      };
    }

    if (raw.length === 0) {
      return {
        agentId: agent.id,
        agentName: agent.name,
        isOnline: true,
        newDevices: [],
        knownDevices: [],
      };
    }

    const serials = raw
      .map((d) => d.serialNumber)
      .filter((s): s is string => !!s);
    const existing = serials.length
      ? await this.deviceRepo
          .createQueryBuilder('d')
          .where('d.serialNo IN (:...serials)', { serials })
          .getMany()
      : [];
    const existingMap = new Map(existing.map((d) => [d.serialNo, d]));

    const newDevices: AgentDiscoveredDevice[] = [];
    const knownDevices: AgentDiscoveredResult['knownDevices'] = [];

    for (const d of raw) {
      const match = existingMap.get(d.serialNumber);
      if (match) {
        knownDevices.push({ ...d, dbDeviceId: match.id, dbName: match.name });
      } else {
        newDevices.push(d);
      }
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      isOnline: true,
      newDevices,
      knownDevices,
    };
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    const agent = await this.findOne(current, id);
    if (dto.name !== undefined) agent.name = dto.name.trim();
    if (dto.hostInfo !== undefined) agent.hostInfo = dto.hostInfo;
    return this.repo.save(agent);
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const agent = await this.findOne(current, id);
    await this.repo.remove(agent);
  }

  /**
   * Agent ulanganida chaqiriladi — companyId + name bo'yicha topadi yoki yaratadi.
   * Bu auto-registration: mijoz oldindan admin panelda agent yaratmasdan ham
   * shunchaki AGENT_NAME bilan ulansa, yangi yozuv avtomatik paydo bo'ladi.
   */
  async findOrCreateForConnect(
    companyId: string,
    name: string,
  ): Promise<AgentEntity> {
    const existing = await this.repo.findOne({
      where: { companyId, name },
    });
    if (existing) return existing;
    const created = this.repo.create({
      companyId,
      name,
      isOnline: false,
      lastSeenAt: null,
    });
    return this.repo.save(created);
  }

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (
      current.role === 'company_admin' &&
      companyId !== current.companyId
    ) {
      throw new ForbiddenException('boshqa kampaniya agentiga ruxsat yo\'q');
    }
  }
}
