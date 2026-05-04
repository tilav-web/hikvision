import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Jimp } from 'jimp';
import { PersonEntity } from '../entities/person.entity';
import { PersonDeviceEntity } from '../entities/person-device.entity';
import { DeviceEntity } from '../entities/device.entity';
import { DevicesService } from '../devices/devices.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { IsapiUserInfo } from '../isapi/isapi.types';
import { AgentsGateway } from '../agents/agents.gateway';

const FACE_DIR = path.join(process.cwd(), 'uploads', 'faces');

@Injectable()
export class PersonsService {
  private readonly logger = new Logger(PersonsService.name);

  constructor(
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
    @InjectRepository(PersonDeviceEntity)
    private readonly linkRepo: Repository<PersonDeviceEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    private readonly devicesService: DevicesService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  // ───────── CRUD ─────────

  /**
   * Bir so'rovda: user yaratish + (ixtiyoriy) yuz rasmi + (ixtiyoriy) aparatlarga sinxron.
   */
  async createWithFace(
    dto: CreatePersonDto,
    fileBuffer?: Buffer,
  ): Promise<{
    person: PersonEntity;
    sync?: { success: string[]; failed: Array<{ deviceId: string; error: string }> };
  }> {
    const created = await this.create(dto);
    if (fileBuffer && fileBuffer.length) {
      await this.setFaceImage(created.id, fileBuffer);
    }
    if (dto.autoSync) {
      const sync = await this.syncToDevices(created.id);
      return { person: await this.findOne(created.id), sync };
    }
    return { person: await this.findOne(created.id) };
  }

  async create(dto: CreatePersonDto): Promise<PersonEntity> {
    const exists = await this.personRepo.findOne({ where: { employeeNo: dto.employeeNo } });
    if (exists) throw new ConflictException(`employeeNo ${dto.employeeNo} band`);

    const person = this.personRepo.create({
      employeeNo: dto.employeeNo,
      name: dto.name,
      userType: dto.userType ?? 'normal',
      gender: dto.gender ?? 'unknown',
      beginTime: dto.beginTime ? new Date(dto.beginTime) : null,
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      cardNo: dto.cardNo ?? null,
      pinHash: dto.pin ?? null, // hozircha to'g'ridan-to'g'ri (aparatga yuboriladi). Production: hash + reversible vault
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      externalUserId: dto.externalUserId ?? null,
    });
    const saved = await this.personRepo.save(person);

    // Aparatga sinxronlash uchun link yaratamiz
    const targetDevices = await this.resolveTargetDevices(dto.deviceIds);
    if (targetDevices.length) {
      await this.linkRepo.save(
        targetDevices.map((d) =>
          this.linkRepo.create({
            personId: saved.id,
            deviceId: d.id,
            status: 'pending',
          }),
        ),
      );
    }
    return saved;
  }

  async findAll(opts: { skip?: number; take?: number; q?: string } = {}): Promise<{
    items: PersonEntity[];
    total: number;
  }> {
    const qb = this.personRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.deviceLinks', 'dl')
      .orderBy('p.createdAt', 'DESC');
    if (opts.q) {
      qb.where('p.name ILIKE :q OR p.employeeNo ILIKE :q OR p.phone ILIKE :q', {
        q: `%${opts.q}%`,
      });
    }
    qb.skip(opts.skip ?? 0).take(opts.take ?? 50);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(id: string): Promise<PersonEntity> {
    const p = await this.personRepo.findOne({
      where: { id },
      relations: { deviceLinks: { device: true } },
    });
    if (!p) throw new NotFoundException(`Person ${id} topilmadi`);
    return p;
  }

  async findByEmployeeNo(employeeNo: string): Promise<PersonEntity | null> {
    return this.personRepo.findOne({ where: { employeeNo } });
  }

  async update(id: string, dto: UpdatePersonDto): Promise<PersonEntity> {
    const p = await this.findOne(id);
    Object.assign(p, {
      name: dto.name ?? p.name,
      userType: dto.userType ?? p.userType,
      gender: dto.gender ?? p.gender,
      beginTime: dto.beginTime ? new Date(dto.beginTime) : p.beginTime,
      endTime: dto.endTime ? new Date(dto.endTime) : p.endTime,
      cardNo: dto.cardNo ?? p.cardNo,
      pinHash: dto.pin ?? p.pinHash,
      phone: dto.phone ?? p.phone,
      email: dto.email ?? p.email,
      externalUserId: dto.externalUserId ?? p.externalUserId,
    });
    const saved = await this.personRepo.save(p);

    // Sinxronni eski "synced" → "pending" qilamiz, chunki ma'lumot o'zgardi
    await this.linkRepo.update({ personId: id }, { status: 'pending' });

    // Yangi aparatlar berilgan bo'lsa, link qo'shamiz
    if (dto.deviceIds?.length) {
      const devices = await this.resolveTargetDevices(dto.deviceIds);
      const existing = await this.linkRepo.find({ where: { personId: id } });
      const existingSet = new Set(existing.map((l) => l.deviceId));
      const toAdd = devices.filter((d) => !existingSet.has(d.id));
      if (toAdd.length) {
        await this.linkRepo.save(
          toAdd.map((d) =>
            this.linkRepo.create({ personId: id, deviceId: d.id, status: 'pending' }),
          ),
        );
      }
    }
    return saved;
  }

  /** Userni serverdan va barcha aparatlardan o'chirish. */
  async remove(id: string): Promise<{ removedFrom: string[]; failures: string[] }> {
    const p = await this.findOne(id);
    const removedFrom: string[] = [];
    const failures: string[] = [];

    for (const link of p.deviceLinks ?? []) {
      try {
        const client = await this.devicesService.getClient(link.deviceId);
        await client.deleteUser(p.employeeNo).catch(() => undefined);
        await client.deleteFace(p.employeeNo).catch(() => undefined);
        removedFrom.push(link.deviceId);
      } catch (e) {
        failures.push(`${link.deviceId}: ${(e as Error).message}`);
      }
    }

    if (p.faceImagePath) {
      await fs.unlink(p.faceImagePath).catch(() => undefined);
    }
    await this.personRepo.remove(p);
    return { removedFrom, failures };
  }

  // ───────── Yuz rasmini saqlash + siqish ─────────

  /**
   * JPEG buffer kiradi → Jimp bilan 480px gacha kichraytirib, sifatni 80% qilamiz.
   * Aparat ≤200KB kutadi, aksariyat hollarda shu yetarli.
   */
  async setFaceImage(id: string, fileBuffer: Buffer): Promise<PersonEntity> {
    const p = await this.findOne(id);
    await fs.mkdir(FACE_DIR, { recursive: true });

    const img = await Jimp.read(fileBuffer);
    const w = img.bitmap.width;
    if (w > 480) {
      img.resize({ w: 480 });
    }
    const out = await img.getBuffer('image/jpeg', { quality: 80 });

    const dest = path.join(FACE_DIR, `${p.id}.jpg`);
    await fs.writeFile(dest, out);

    p.faceImagePath = dest;
    await this.personRepo.save(p);

    // Yuz o'zgardi → sinxron qayta kerak
    await this.linkRepo.update({ personId: id }, { status: 'pending', faceSynced: false });
    return p;
  }

  async getFaceBuffer(id: string): Promise<Buffer | null> {
    const p = await this.findOne(id);
    if (!p.faceImagePath) return null;
    return fs.readFile(p.faceImagePath).catch(() => null);
  }

  // ───────── Aparatlarga sinxronlash ─────────

  /** Bitta personni o'ziga biriktirilgan barcha aparatlarga yuborish. */
  async syncToDevices(personId: string): Promise<{
    success: string[];
    failed: Array<{ deviceId: string; error: string }>;
  }> {
    const p = await this.findOne(personId);
    const success: string[] = [];
    const failed: Array<{ deviceId: string; error: string }> = [];

    for (const link of p.deviceLinks ?? []) {
      try {
        await this.syncOne(p, link.deviceId);
        success.push(link.deviceId);
      } catch (e) {
        failed.push({ deviceId: link.deviceId, error: (e as Error).message });
      }
    }
    return { success, failed };
  }

  /** Bitta person → bitta aparat. */
  async syncOne(person: PersonEntity, deviceId: string): Promise<void> {
    const link = await this.linkRepo.findOne({
      where: { personId: person.id, deviceId },
    });
    const linkRecord =
      link ??
      this.linkRepo.create({ personId: person.id, deviceId, status: 'pending' });

    try {
      const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
      if (!device) throw new Error(`device ${deviceId} topilmadi`);

      // Agent rejimi: aparatga to'g'ridan-to'g'ri emas, agent orqali yuboramiz
      if (device.agentToken && this.agentsGateway.isOnline(deviceId)) {
        await this.syncOneViaAgent(person, deviceId, linkRecord);
      } else {
        await this.syncOneDirect(person, deviceId, linkRecord);
      }

      linkRecord.status = 'synced';
      linkRecord.syncedAt = new Date();
      linkRecord.lastError = null;
      await this.linkRepo.save(linkRecord);
    } catch (e) {
      linkRecord.status = 'failed';
      linkRecord.lastError = (e as Error).message;
      await this.linkRepo.save(linkRecord);
      throw e;
    }
  }

  private async syncOneDirect(
    person: PersonEntity,
    deviceId: string,
    linkRecord: PersonDeviceEntity,
  ): Promise<void> {
    const client = await this.devicesService.getClient(deviceId);
    const userInfo = this.toIsapiUser(person);

    const search = await client.searchUsers({ employeeNo: person.employeeNo, maxResults: 1 });
    if (search.totalMatches > 0) {
      await client.updateUser(userInfo);
    } else {
      await client.addUser(userInfo);
    }

    if (person.faceImagePath) {
      const buf = await fs.readFile(person.faceImagePath);
      await client.uploadFace(person.employeeNo, buf);
      linkRecord.faceSynced = true;
    }

    if (person.cardNo) {
      await client.addCard(person.employeeNo, person.cardNo).catch(() => undefined);
      linkRecord.cardSynced = true;
    }
  }

  private async syncOneViaAgent(
    person: PersonEntity,
    deviceId: string,
    linkRecord: PersonDeviceEntity,
  ): Promise<void> {
    const userInfo = this.toIsapiUser(person);
    let imageBase64: string | undefined;
    if (person.faceImagePath) {
      const buf = await fs.readFile(person.faceImagePath);
      imageBase64 = buf.toString('base64');
    }

    const result = await this.agentsGateway.sendCommand<{
      user: 'added' | 'updated';
      face: boolean;
      card: boolean;
    }>(deviceId, 'syncPerson', {
      userInfo,
      imageBase64,
      cardNo: person.cardNo ?? undefined,
    });

    if (result?.face) linkRecord.faceSynced = true;
    if (result?.card) linkRecord.cardSynced = true;
  }

  /** Aparatdan personni olib tashlash (faqat aparatdan, DB'da qoladi). */
  async removeFromDevice(personId: string, deviceId: string): Promise<void> {
    const p = await this.findOne(personId);
    const client = await this.devicesService.getClient(deviceId);
    await client.deleteFace(p.employeeNo).catch(() => undefined);
    await client.deleteUser(p.employeeNo);
    await this.linkRepo.delete({ personId, deviceId });
  }

  // ───────── ichki ─────────

  private async resolveTargetDevices(ids?: string[]): Promise<DeviceEntity[]> {
    if (ids && ids.length) {
      return this.deviceRepo.findBy({ id: In(ids) });
    }
    return this.deviceRepo.find();
  }

  private toIsapiUser(p: PersonEntity): IsapiUserInfo {
    const begin = (p.beginTime ?? new Date('2020-01-01T00:00:00Z')).toISOString().slice(0, 19);
    const end = (p.endTime ?? new Date('2037-12-31T23:59:59Z')).toISOString().slice(0, 19);
    return {
      employeeNo: p.employeeNo,
      name: p.name,
      userType: p.userType,
      gender: p.gender,
      Valid: { enable: true, beginTime: begin, endTime: end },
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
      ...(p.pinHash ? { password: p.pinHash } : {}),
    };
  }
}
