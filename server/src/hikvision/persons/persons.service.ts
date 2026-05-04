import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { AuthUser } from '../../auth/current-user.decorator';

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

  async createWithFace(
    current: AuthUser,
    dto: CreatePersonDto,
    fileBuffer?: Buffer,
  ): Promise<{
    person: PersonEntity;
    sync?: { success: string[]; failed: Array<{ deviceId: string; error: string }> };
  }> {
    const created = await this.create(current, dto);
    if (fileBuffer && fileBuffer.length) {
      await this.setFaceImage(current, created.id, fileBuffer);
    }
    if (dto.autoSync) {
      const sync = await this.syncToDevices(current, created.id);
      return { person: await this.findOne(current, created.id), sync };
    }
    return { person: await this.findOne(current, created.id) };
  }

  async create(current: AuthUser, dto: CreatePersonDto): Promise<PersonEntity> {
    const companyId =
      current.role === 'company_admin' ? current.companyId : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('companyId shart');
    }

    const exists = await this.personRepo.findOne({
      where: { companyId, employeeNo: dto.employeeNo },
    });
    if (exists) {
      throw new ConflictException(
        `employeeNo ${dto.employeeNo} ushbu kampaniyada band`,
      );
    }

    const person = this.personRepo.create({
      companyId,
      employeeNo: dto.employeeNo,
      name: dto.name,
      userType: dto.userType ?? 'normal',
      gender: dto.gender ?? 'unknown',
      beginTime: dto.beginTime ? new Date(dto.beginTime) : null,
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      cardNo: dto.cardNo ?? null,
      pinHash: dto.pin ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      externalUserId: dto.externalUserId ?? null,
      scheduleId: dto.scheduleId ?? null,
      position: dto.position ?? null,
      baseSalary: dto.baseSalary ?? null,
    });
    const saved = await this.personRepo.save(person);

    const targetDevices = await this.resolveTargetDevices(companyId, dto.deviceIds);
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

  async findAll(
    current: AuthUser,
    opts: {
      skip?: number;
      take?: number;
      q?: string;
      companyId?: string;
    } = {},
  ): Promise<{ items: PersonEntity[]; total: number }> {
    const qb = this.personRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.deviceLinks', 'dl')
      .orderBy('p.createdAt', 'DESC');

    const companyFilter = this.resolveCompanyFilter(current, opts.companyId);
    if (companyFilter) {
      qb.andWhere('p.companyId = :cid', { cid: companyFilter });
    }
    if (opts.q) {
      qb.andWhere(
        '(p.name ILIKE :q OR p.employeeNo ILIKE :q OR p.phone ILIKE :q)',
        { q: `%${opts.q}%` },
      );
    }
    qb.skip(opts.skip ?? 0).take(opts.take ?? 50);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findOne(current: AuthUser, id: string): Promise<PersonEntity> {
    const p = await this.personRepo.findOne({
      where: { id },
      relations: { deviceLinks: { device: true } },
    });
    if (!p) throw new NotFoundException(`Person ${id} topilmadi`);
    this.assertAccess(current, p.companyId);
    return p;
  }

  /** Internal — no access check */
  async findByEmployeeNoAndCompany(
    companyId: string,
    employeeNo: string,
  ): Promise<PersonEntity | null> {
    return this.personRepo.findOne({ where: { companyId, employeeNo } });
  }

  async update(
    current: AuthUser,
    id: string,
    dto: UpdatePersonDto,
  ): Promise<PersonEntity> {
    const p = await this.findOne(current, id);
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
      scheduleId: dto.scheduleId ?? p.scheduleId,
      position: dto.position ?? p.position,
      baseSalary: dto.baseSalary ?? p.baseSalary,
    });
    const saved = await this.personRepo.save(p);

    await this.linkRepo.update({ personId: id }, { status: 'pending' });

    if (dto.deviceIds?.length) {
      const devices = await this.resolveTargetDevices(p.companyId!, dto.deviceIds);
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

  async remove(
    current: AuthUser,
    id: string,
  ): Promise<{ removedFrom: string[]; failures: string[] }> {
    const p = await this.findOne(current, id);
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

  async setFaceImage(
    current: AuthUser,
    id: string,
    fileBuffer: Buffer,
  ): Promise<PersonEntity> {
    const p = await this.findOne(current, id);
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

    await this.linkRepo.update({ personId: id }, { status: 'pending', faceSynced: false });
    return p;
  }

  async getFaceBuffer(current: AuthUser, id: string): Promise<Buffer | null> {
    const p = await this.findOne(current, id);
    if (!p.faceImagePath) return null;
    return fs.readFile(p.faceImagePath).catch(() => null);
  }

  // ───────── Aparatlarga sinxronlash ─────────

  async syncToDevices(
    current: AuthUser,
    personId: string,
  ): Promise<{
    success: string[];
    failed: Array<{ deviceId: string; error: string }>;
  }> {
    const p = await this.findOne(current, personId);
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

      // Agent rejimi: aparat agentga bog'langan va agent online bo'lsa
      if (device.agentId && this.agentsGateway.isAgentOnline(device.agentId)) {
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

  async removeFromDevice(
    current: AuthUser,
    personId: string,
    deviceId: string,
  ): Promise<void> {
    const p = await this.findOne(current, personId);
    const client = await this.devicesService.getClient(deviceId);
    await client.deleteFace(p.employeeNo).catch(() => undefined);
    await client.deleteUser(p.employeeNo);
    await this.linkRepo.delete({ personId: p.id, deviceId });
  }

  // ───────── ichki ─────────

  private resolveCompanyFilter(
    current: AuthUser,
    requested?: string,
  ): string | null {
    if (current.role === 'company_admin') return current.companyId!;
    return requested ?? null;
  }

  private assertAccess(current: AuthUser, companyId: string | null): void {
    if (current.role === 'company_admin' && companyId !== current.companyId) {
      throw new ForbiddenException('boshqa kampaniya hodimi');
    }
  }

  private async resolveTargetDevices(
    companyId: string,
    ids?: string[],
  ): Promise<DeviceEntity[]> {
    if (ids && ids.length) {
      const found = await this.deviceRepo.findBy({ id: In(ids), companyId });
      if (found.length !== ids.length) {
        throw new BadRequestException(
          'ba\'zi qurilmalar topilmadi yoki sizning kampaniyangizga tegishli emas',
        );
      }
      return found;
    }
    return this.deviceRepo.findBy({ companyId });
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
