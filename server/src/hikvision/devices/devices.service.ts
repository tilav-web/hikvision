import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity } from '../entities/device.entity';
import { IsapiClient } from '../isapi/isapi.client';
import { decryptSecret, encryptSecret } from '../../common/crypto.util';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private readonly clientCache = new Map<string, IsapiClient>();

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly repo: Repository<DeviceEntity>,
    private readonly cfg: ConfigService,
  ) {}

  // ───────── CRUD ─────────

  async create(dto: CreateDeviceDto): Promise<DeviceEntity> {
    const useHttps = dto.useHttps ?? false;
    const entity = this.repo.create({
      name: dto.name,
      host: dto.host,
      port: dto.port ?? (useHttps ? 443 : 80),
      useHttps,
      username: dto.username,
      passwordEnc: encryptSecret(dto.password),
      location: dto.location ?? null,
    });
    const saved = await this.repo.save(entity);
    // Aparatdan info olib, modelni saqlaymiz (ulanmasa ham qabul qilamiz, keyin /test bilan)
    this.tryEnrichDeviceInfo(saved.id).catch((e) =>
      this.logger.warn(`enrich on create failed: ${e.message}`),
    );
    return saved;
  }

  async findAll(): Promise<DeviceEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<DeviceEntity> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException(`Device ${id} topilmadi`);
    return d;
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<DeviceEntity> {
    const d = await this.findOne(id);
    if (dto.name !== undefined) d.name = dto.name;
    if (dto.host !== undefined) d.host = dto.host;
    if (dto.port !== undefined) d.port = dto.port;
    if (dto.useHttps !== undefined) d.useHttps = dto.useHttps;
    if (dto.username !== undefined) d.username = dto.username;
    if (dto.password !== undefined) d.passwordEnc = encryptSecret(dto.password);
    if (dto.location !== undefined) d.location = dto.location;
    this.invalidateClient(id);
    return this.repo.save(d);
  }

  async remove(id: string): Promise<void> {
    const d = await this.findOne(id);
    this.invalidateClient(id);
    await this.repo.remove(d);
  }

  // ───────── ISAPI bilan ishlash ─────────

  /** Har bir aparat uchun bitta IsapiClient cache. */
  async getClient(id: string): Promise<IsapiClient> {
    const cached = this.clientCache.get(id);
    if (cached) return cached;
    const d = await this.findOne(id);
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
  async testConnection(id: string): Promise<{ ok: boolean; info?: any; error?: string }> {
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
  async setupListener(id: string): Promise<{ ok: boolean; url: string; error?: string }> {
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

  async openDoor(id: string, doorNo = 1): Promise<void> {
    const client = await this.getClient(id);
    await client.openDoor(doorNo);
  }

  async reboot(id: string): Promise<void> {
    const client = await this.getClient(id);
    await client.reboot();
  }

  async syncTime(id: string): Promise<void> {
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

  private async tryEnrichDeviceInfo(id: string): Promise<void> {
    const res = await this.testConnection(id);
    if (!res.ok) this.logger.warn(`enrich: ${res.error}`);
  }
}
