import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AccessEventEntity } from '../entities/access-event.entity';
import { PersonEntity } from '../entities/person.entity';
import { DeviceEntity } from '../entities/device.entity';
import { parseAcsEventPayload } from '../isapi/isapi.parser';
import { EventsGateway } from './events.gateway';
import { DevicesService } from '../devices/devices.service';
import { AuthUser } from '../../auth/current-user.decorator';
import { AttendanceService } from '../attendance/attendance.service';

const EVENT_PIC_DIR = path.join(process.cwd(), 'uploads', 'events');

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(AccessEventEntity)
    private readonly eventRepo: Repository<AccessEventEntity>,
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    private readonly devicesService: DevicesService,
    private readonly gateway: EventsGateway,
    private readonly attendance: AttendanceService,
  ) {}

  /**
   * Aparatdan kelgan event'ni qabul qilish.
   * `payload` — JSON. `picture` — agar multipart bilan rasm kelgan bo'lsa.
   * `clientIp` — qaysi aparatdan kelganini topish uchun.
   */
  async ingest(opts: {
    payload: any;
    picture?: Buffer;
    clientIp?: string;
  }): Promise<AccessEventEntity | null> {
    // Heartbeat — faqat tiriklik signali, bazaga saqlamaymiz
    const eventType: string | undefined = opts.payload?.eventType;
    if (eventType === 'heartBeat' || eventType === 'heartbeat') {
      const device = await this.resolveDevice(opts.payload, opts.clientIp);
      if (device) {
        await this.devicesService.markSeen(device.id);
        this.gateway.emitDeviceStatus(device.id, true);
      }
      return null;
    }

    const parsed = parseAcsEventPayload(opts.payload);
    if (!parsed) {
      this.logger.debug(`unrecognized event: ${JSON.stringify(opts.payload).slice(0, 200)}`);
      return null;
    }

    const device = await this.resolveDevice(opts.payload, opts.clientIp);
    if (!device) {
      this.logger.warn(
        `event from unknown device, ip=${opts.clientIp}, deviceID=${opts.payload?.deviceID}`,
      );
      return null;
    }

    await this.devicesService.markSeen(device.id);

    let person: PersonEntity | null = null;
    if (parsed.employeeNo && device.companyId) {
      person = await this.personRepo.findOne({
        where: { employeeNo: parsed.employeeNo, companyId: device.companyId },
      });
    }

    let pictureUrl: string | null = null;
    if (opts.picture && opts.picture.length) {
      pictureUrl = await this.savePicture(opts.picture);
    }

    // Yo'nalishni aniqlash:
    //  - device.mode 'entry'/'exit' bo'lsa — qurilma rejimidan;
    //  - 'both' bo'lsa — qurilmadan kelgan tugma signali (parser extract qilgan)
    let direction: 'in' | 'out' | null = null;
    let directionSource: 'device_mode' | 'button' | 'manual' | null = null;
    if (device.mode === 'entry') {
      direction = 'in';
      directionSource = 'device_mode';
    } else if (device.mode === 'exit') {
      direction = 'out';
      directionSource = 'device_mode';
    } else if (parsed.direction) {
      direction = parsed.direction;
      directionSource = 'button';
    }

    const event = this.eventRepo.create({
      companyId: device.companyId,
      deviceId: device.id,
      personId: person?.id ?? null,
      employeeNo: parsed.employeeNo,
      personName: parsed.personName,
      category: parsed.category,
      majorEvent: parsed.majorEvent,
      minorEvent: parsed.minorEvent,
      verifyMode: parsed.verifyMode,
      direction,
      directionSource,
      capturedAt: parsed.capturedAt,
      pictureUrl,
      raw: parsed.raw,
    });
    const saved = await this.eventRepo.save(event);

    const who =
      person?.name || parsed.personName || parsed.employeeNo || 'Noma\'lum';
    const icon =
      parsed.category === 'accessGranted'
        ? '✅'
        : parsed.category === 'accessDenied'
        ? '❌'
        : parsed.category === 'doorOpen'
        ? '🔓'
        : parsed.category === 'doorClose'
        ? '🔒'
        : 'ℹ️ ';
    this.logger.log(
      `${icon} ${parsed.category.toUpperCase()} | ${who} | ${parsed.verifyMode} | ` +
        `${device.name} | ${parsed.capturedAt.toISOString()}`,
    );

    this.gateway.emitAccessEvent(saved, { deviceName: device.name });

    // Davomatga ta'sir qiladigan event bo'lsa, attendance'ni yangilash
    this.attendance.ingestEvent(saved).catch((e) =>
      this.logger.warn(`attendance ingest failed: ${(e as Error).message}`),
    );

    return saved;
  }

  async list(opts: {
    current: AuthUser;
    deviceId?: string;
    personId?: string;
    companyId?: string;
    from?: Date;
    to?: Date;
    /** Aniq kategoriyalar bo'yicha filter (bir nechta bo'lsa OR) */
    categories?: string[];
    /** Default'ga ko'ra 'unknown' yashiradi (UI uchun shovqin kam) */
    includeUnknown?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.deviceId) where.deviceId = opts.deviceId;
    if (opts.personId) where.personId = opts.personId;
    if (opts.from && opts.to) where.capturedAt = Between(opts.from, opts.to);

    if (opts.categories && opts.categories.length > 0) {
      where.category = In(opts.categories);
    } else if (!opts.includeUnknown) {
      where.category = Not('unknown' as any);
    }

    const [items, total] = await this.eventRepo.findAndCount({
      where,
      order: { capturedAt: 'DESC' },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      relations: { device: true, person: true },
    });
    return { items, total };
  }

  /**
   * Eski hodisalarni o'chirish (admin yoki cron orqali).
   * `olderThanDays` belgilangan kunlardan eski yozuvlarni o'chiradi.
   */
  async cleanup(
    current: AuthUser,
    opts: { olderThanDays?: number; onlyUnknown?: boolean } = {},
  ): Promise<{ deleted: number; cutoff: string }> {
    const days = Math.max(1, opts.olderThanDays ?? 90);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const qb = this.eventRepo
      .createQueryBuilder()
      .delete()
      .where('"capturedAt" < :cutoff', { cutoff });

    if (current.role === 'company_admin') {
      qb.andWhere('"companyId" = :cid', { cid: current.companyId });
    }
    if (opts.onlyUnknown) {
      qb.andWhere('category = :cat', { cat: 'unknown' });
    }

    const res = await qb.execute();
    const deleted = res.affected ?? 0;
    this.logger.log(
      `🧹 cleanup: ${deleted} ta hodisa o'chirildi (cutoff: ${cutoff.toISOString()}, onlyUnknown=${!!opts.onlyUnknown})`,
    );
    return { deleted, cutoff: cutoff.toISOString() };
  }

  // ───────── ichki ─────────

  private async resolveDevice(payload: any, clientIp?: string): Promise<DeviceEntity | null> {
    // 1. Payloaddagi ipAddress ham bo'lishi mumkin
    const ipFromPayload: string | undefined = payload?.ipAddress;
    const candidate = ipFromPayload || (clientIp ? clientIp.replace(/^::ffff:/, '') : undefined);
    if (candidate) {
      const d = await this.devicesService.findByHost(candidate);
      if (d) return d;
    }
    // 2. Serial number bo'yicha
    const sn: string | undefined = payload?.serialNo || payload?.deviceID;
    if (sn) {
      const d = await this.deviceRepo.findOne({ where: { serialNo: sn } });
      if (d) return d;
    }
    return null;
  }

  private async savePicture(buf: Buffer): Promise<string> {
    await fs.mkdir(EVENT_PIC_DIR, { recursive: true });
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const dest = path.join(EVENT_PIC_DIR, filename);
    await fs.writeFile(dest, buf);
    return `/uploads/events/${filename}`;
  }
}
