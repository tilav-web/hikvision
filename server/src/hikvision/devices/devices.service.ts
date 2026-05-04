import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity } from '../entities/device.entity';
import { AgentEntity } from '../entities/agent.entity';
import { IsapiClient } from '../isapi/isapi.client';
import { decryptSecret, encryptSecret } from '../../common/crypto.util';
import { AuthUser } from '../../auth/current-user.decorator';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { AgentsGateway } from '../agents/agents.gateway';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private readonly clientCache = new Map<string, IsapiClient>();

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly repo: Repository<DeviceEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly cfg: ConfigService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  // ───────── CRUD ─────────

  async create(current: AuthUser, dto: CreateDeviceDto): Promise<DeviceEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId shart');
    }

    if (dto.agentId) {
      await this.assertAgentInCompany(dto.agentId, companyId);
    }

    const useHttps = dto.useHttps ?? false;
    const entity = this.repo.create({
      companyId,
      agentId: dto.agentId ?? null,
      name: dto.name,
      mode: dto.mode ?? 'both',
      host: dto.host,
      port: dto.port ?? (useHttps ? 443 : 80),
      useHttps,
      username: dto.username,
      passwordEnc: encryptSecret(dto.password),
      location: dto.location ?? null,
    });
    const saved = await this.repo.save(entity);

    // Aparatdan info olib, modelni saqlaymiz (ulanmasa ham qabul qilamiz)
    this.tryEnrichDeviceInfo(saved.id).catch((e) =>
      this.logger.warn(`enrich on create failed: ${e.message}`),
    );

    if (saved.agentId) {
      this.agentsGateway.pushDeviceUpdate(saved.agentId).catch(() => undefined);
    }

    return saved;
  }

  async findAll(
    current: AuthUser,
    opts: { companyId?: string; agentId?: string } = {},
  ): Promise<DeviceEntity[]> {
    const where: Record<string, any> = {};
    if (current.role === 'company_admin') {
      where.companyId = current.companyId!;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.agentId) where.agentId = opts.agentId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(current: AuthUser, id: string): Promise<DeviceEntity> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Device ${id} topilmadi`);
    this.assertAccess(current, d.companyId);
    return d;
  }

  /** Internal — ruxsat tekshirilmaydi, faqat ichki kodlar uchun */
  async findOneInternal(id: string): Promise<DeviceEntity> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Device ${id} topilmadi`);
    return d;
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdateDeviceDto,
  ): Promise<DeviceEntity> {
    const d = await this.findOne(current, id);
    const oldAgentId = d.agentId;

    if (dto.agentId !== undefined) {
      if (dto.agentId === null) {
        d.agentId = null;
      } else {
        await this.assertAgentInCompany(dto.agentId, d.companyId);
        d.agentId = dto.agentId;
      }
    }
    if (dto.name !== undefined) d.name = dto.name;
    if (dto.mode !== undefined) d.mode = dto.mode;
    if (dto.host !== undefined) d.host = dto.host;
    if (dto.port !== undefined) d.port = dto.port;
    if (dto.useHttps !== undefined) d.useHttps = dto.useHttps;
    if (dto.username !== undefined) d.username = dto.username;
    if (dto.password !== undefined) d.passwordEnc = encryptSecret(dto.password);
    if (dto.location !== undefined) d.location = dto.location;

    this.invalidateClient(id);
    const saved = await this.repo.save(d);

    // Agar agent o'zgarsa, eski va yangi agentlarga yangilanish jo'natamiz
    const affected = new Set<string>();
    if (oldAgentId) affected.add(oldAgentId);
    if (saved.agentId) affected.add(saved.agentId);
    affected.forEach((aId) =>
      this.agentsGateway.pushDeviceUpdate(aId).catch(() => undefined),
    );

    return saved;
  }

  async remove(current: AuthUser, id: string): Promise<void> {
    const d = await this.findOne(current, id);
    const agentId = d.agentId;
    this.invalidateClient(id);
    await this.repo.remove(d);
    if (agentId) {
      this.agentsGateway.pushDeviceUpdate(agentId).catch(() => undefined);
    }
  }

  // ───────── ISAPI bilan ishlash ─────────

  /** Har bir aparat uchun bitta IsapiClient cache. */
  async getClient(id: string): Promise<IsapiClient> {
    const cached = this.clientCache.get(id);
    if (cached) return cached;
    const d = await this.findOneInternal(id);
    const client = new IsapiClient({
      host: d.host,
      port: d.port,
      useHttps: d.useHttps,
      username: d.username,
      password: decryptSecret(d.passwordEnc),
      timeoutMs: parseInt(this.cfg.get<string>('ISAPI_TIMEOUT_MS', '15000'), 10),
    });
    this.clientCache.set(id, client);
    return client;
  }

  invalidateClient(id: string): void {
    this.clientCache.delete(id);
  }

  /** Ulanishni tekshirish — deviceInfo so'rab ko'ramiz. */
  async testConnection(
    current: AuthUser,
    id: string,
  ): Promise<{ ok: boolean; info?: any; error?: string }> {
    await this.findOne(current, id); // access check
    try {
      const client = await this.getClient(id);
      const info = await client.getDeviceInfo();
      await this.repo.update(id, {
        isOnline: true,
        lastSeenAt: new Date(),
        serialNo: info.serialNumber,
        model: info.model,
        firmwareVersion: info.firmwareVersion,
        macAddress: info.macAddress,
      });
      return { ok: true, info };
    } catch (e) {
      const msg = (e as Error).message;
      await this.repo.update(id, { isOnline: false });
      return { ok: false, error: msg };
    }
  }

  /** Aparatga "event'larni shu URL ga yubor" deb sozlaymiz. */
  async setupListener(
    current: AuthUser,
    id: string,
  ): Promise<{ ok: boolean; url: string; error?: string }> {
    await this.findOne(current, id);
    const baseUrl = this.cfg.get<string>('PUBLIC_BASE_URL');
    if (!baseUrl) {
      throw new BadRequestException('PUBLIC_BASE_URL .env da sozlanmagan');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/hikvision/events/receiver`;

    try {
      const client = await this.getClient(id);
      const protocolType = url.startsWith('https') ? 'HTTPS' : 'HTTP';
      await client.setupListenerHost({
        id: 1,
        url,
        protocolType,
        parameterFormatType: 'JSON',
        addressingFormatType: 'ipaddress',
      });
      await this.repo.update(id, { listenerConfigured: true });
      return { ok: true, url };
    } catch (e) {
      return { ok: false, url, error: (e as Error).message };
    }
  }

  async openDoor(current: AuthUser, id: string, doorNo = 1): Promise<void> {
    await this.findOne(current, id);
    const client = await this.getClient(id);
    await client.openDoor(doorNo);
  }

  async reboot(current: AuthUser, id: string): Promise<void> {
    await this.findOne(current, id);
    const client = await this.getClient(id);
    await client.reboot();
  }

  async syncTime(current: AuthUser, id: string): Promise<void> {
    await this.findOne(current, id);
    const client = await this.getClient(id);
    await client.setTimeNow();
  }

  /** Aparat onlayn ekanini event keldi deb yangilash. */
  async markSeen(id: string): Promise<void> {
    await this.repo.update(id, { isOnline: true, lastSeenAt: new Date() });
  }

  /** IP bo'yicha aparatni topish (event receiver uchun). */
  async findByHost(host: string): Promise<DeviceEntity | null> {
    return this.repo.findOne({ where: { host } });
  }

  // ───────── ichki ─────────

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException('boshqa kampaniya qurilmasiga ruxsat yo\'q');
    }
  }

  private async assertAgentInCompany(
    agentId: string,
    companyId: string | null,
  ): Promise<void> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new BadRequestException(`agent ${agentId} topilmadi`);
    if (companyId && agent.companyId && agent.companyId !== companyId) {
      throw new BadRequestException(
        `agent ${agentId} boshqa kampaniyaga tegishli`,
      );
    }
  }

  private async tryEnrichDeviceInfo(id: string): Promise<void> {
    try {
      const client = await this.getClient(id);
      const info = await client.getDeviceInfo();
      await this.repo.update(id, {
        isOnline: true,
        lastSeenAt: new Date(),
        serialNo: info.serialNumber,
        model: info.model,
        firmwareVersion: info.firmwareVersion,
        macAddress: info.macAddress,
      });
    } catch (e) {
      this.logger.warn(`enrich: ${(e as Error).message}`);
      await this.repo.update(id, { isOnline: false });
    }
  }
}
