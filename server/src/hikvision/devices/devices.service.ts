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
    let companyId: string | null =
      current.role === 'company_admin'
        ? current.companyId
        : (dto.companyId ?? null);

    if (dto.agentId) {
      const agent = await this.agentRepo.findOne({
        where: { id: dto.agentId },
      });
      if (!agent) {
        throw new BadRequestException(`agent ${dto.agentId} topilmadi`);
      }
      if (companyId && agent.companyId && companyId !== agent.companyId) {
        throw new BadRequestException(
          `agent ${dto.agentId} boshqa kampaniyaga tegishli`,
        );
      }
      companyId = agent.companyId ?? companyId;
    }

    if (!companyId) {
      throw new BadRequestException('companyId yoki agentId shart');
    }

    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException(
        "boshqa kampaniya qurilmasiga ruxsat yo'q",
      );
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
        const agent = await this.agentRepo.findOne({
          where: { id: dto.agentId },
        });
        if (!agent) {
          throw new BadRequestException(`agent ${dto.agentId} topilmadi`);
        }
        if (d.companyId && agent.companyId && d.companyId !== agent.companyId) {
          throw new BadRequestException(
            `agent ${dto.agentId} boshqa kampaniyaga tegishli`,
          );
        }
        if (!d.companyId && agent.companyId) {
          d.companyId = agent.companyId;
        }
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

  /**
   * Aparat bilan ishlash uchun universal dispatcher.
   * Agar aparatga agent biriktirilgan bo'lsa — agent socket orqali yuboramiz
   * (agent LAN'da turib aparatga to'g'ridan-to'g'ri ulanadi).
   * Agar agent biriktirilmagan bo'lsa — server o'zi to'g'ridan-to'g'ri ISAPI chaqiradi.
   */
  private async runOnDevice<T>(
    device: DeviceEntity,
    action: string,
    payload: any,
    directFn: () => Promise<T>,
  ): Promise<T> {
    if (device.agentId) {
      if (!this.agentsGateway.isAgentOnline(device.agentId)) {
        throw new BadRequestException(
          `agent ${device.agentId} ulanmagan — buyruqni bajarib bo'lmaydi`,
        );
      }
      return this.agentsGateway.sendCommand<T>(device.id, action, payload);
    }
    return directFn();
  }

  /** Ulanishni tekshirish — deviceInfo so'rab ko'ramiz. */
  async testConnection(
    current: AuthUser,
    id: string,
  ): Promise<{ ok: boolean; info?: any; error?: string }> {
    const device = await this.findOne(current, id);
    try {
      const info = await this.runOnDevice<any>(
        device,
        'getDeviceInfo',
        {},
        async () => (await this.getClient(id)).getDeviceInfo(),
      );
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
    const device = await this.findOne(current, id);
    const baseUrl = this.cfg.get<string>('PUBLIC_BASE_URL');
    if (!baseUrl) {
      throw new BadRequestException('PUBLIC_BASE_URL .env da sozlanmagan');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/api/hikvision/events/receiver`;
    const protocolType: 'HTTP' | 'HTTPS' = url.startsWith('https') ? 'HTTPS' : 'HTTP';
    const cfg = {
      id: 1,
      url,
      protocolType,
      parameterFormatType: 'JSON' as const,
      addressingFormatType: 'ipaddress' as const,
    };

    try {
      await this.runOnDevice(device, 'setupListener', cfg, async () => {
        await (await this.getClient(id)).setupListenerHost(cfg);
      });
      await this.repo.update(id, { listenerConfigured: true });
      return { ok: true, url };
    } catch (e) {
      return { ok: false, url, error: (e as Error).message };
    }
  }

  async openDoor(current: AuthUser, id: string, doorNo = 1): Promise<void> {
    const device = await this.findOne(current, id);
    await this.runOnDevice(device, 'openDoor', { doorNo }, async () => {
      await (await this.getClient(id)).openDoor(doorNo);
    });
  }

  async reboot(current: AuthUser, id: string): Promise<void> {
    const device = await this.findOne(current, id);
    await this.runOnDevice(device, 'reboot', {}, async () => {
      await (await this.getClient(id)).reboot();
    });
  }

  async syncTime(current: AuthUser, id: string): Promise<void> {
    const device = await this.findOne(current, id);
    await this.runOnDevice(device, 'syncTime', {}, async () => {
      await (await this.getClient(id)).setTimeNow();
    });
  }

  /**
   * Jonli kadr (JPEG snapshot) qaytaradi. `findOne` companyId guard'ini
   * qo'llaydi (super_admin → barcha, company_admin → faqat o'z kampaniyasi).
   * Agent borligida agent socket orqali, aks holda to'g'ridan ISAPI.
   */
  async getSnapshot(
    current: AuthUser,
    id: string,
    channel = 1,
  ): Promise<Buffer> {
    const device = await this.findOne(current, id);
    if (device.agentId) {
      if (!this.agentsGateway.isAgentOnline(device.agentId)) {
        throw new BadRequestException(
          `agent ulanmagan — kameraga ulanib bo'lmaydi`,
        );
      }
      const result = await this.agentsGateway.sendCommand<{
        imageBase64: string;
        bytes: number;
      }>(device.id, 'getSnapshot', { channel }, 10_000);
      return Buffer.from(result.imageBase64, 'base64');
    }
    // Fallback: agentless (server o'zi LAN'ga yetib borishi mumkin bo'lsa).
    const client = await this.getClient(id);
    return client.getSnapshot(channel);
  }

  /** Aparat onlayn ekanini event keldi deb yangilash. */
  async markSeen(id: string): Promise<void> {
    await this.repo.update(id, { isOnline: true, lastSeenAt: new Date() });
  }

  /**
   * IP bo'yicha aparatni topish (event receiver uchun).
   * MUHIM: ikki kampaniya bir xil LAN IP'larni ishlatishi mumkin.
   * Shuning uchun bir nechta natija bo'lsa, qaror noaniq deb null qaytariladi —
   * caller serialNo orqali aniqroq topishi shart.
   */
  async findByHost(host: string): Promise<DeviceEntity | null> {
    const matches = await this.repo.find({ where: { host }, take: 2 });
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      this.logger.warn(
        `findByHost(${host}): ${matches.length}+ ta moslik — noaniq, null qaytarildi`,
      );
      return null;
    }
    return matches[0];
  }

  // ───────── ichki ─────────

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException('boshqa kampaniya qurilmasiga ruxsat yo\'q');
    }
  }

  private async tryEnrichDeviceInfo(id: string): Promise<void> {
    try {
      const device = await this.repo.findOne({ where: { id } });
      if (!device) return;
      const info = await this.runOnDevice<any>(
        device,
        'getDeviceInfo',
        {},
        async () => (await this.getClient(id)).getDeviceInfo(),
      );
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
