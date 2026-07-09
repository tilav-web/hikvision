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
import { CompaniesService } from '../../companies/companies.service';
import { AuditService } from '../../audit/audit.service';

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
    private readonly companies: CompaniesService,
    private readonly audit: AuditService,
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

    // Kvota — tarif limitidan oshmasin.
    const company = await this.companies.findById(companyId);
    if (company.maxEmployees > 0) {
      const count = await this.personRepo.count({ where: { companyId } });
      if (count >= company.maxEmployees) {
        throw new BadRequestException(
          `Hodim limiti to'lgan (${company.maxEmployees}) — tarifni oshiring`,
        );
      }
    }

    const userProvided = !!dto.employeeNo?.trim();

    if (userProvided) {
      const exists = await this.personRepo.findOne({
        where: { companyId, employeeNo: dto.employeeNo!.trim() },
      });
      if (exists) {
        throw new ConflictException(
          `employeeNo ${dto.employeeNo} ushbu kampaniyada band`,
        );
      }
    }

    if (dto.cardNo?.trim()) {
      await this.assertCardNoFree(companyId, dto.cardNo.trim());
    }

    if (dto.pin?.trim()) {
      await this.assertPinFree(companyId, dto.pin.trim());
    }

    const baseFields = {
      companyId,
      name: dto.name,
      userType: dto.userType ?? 'normal',
      gender: dto.gender ?? 'unknown',
      beginTime: dto.beginTime ? new Date(dto.beginTime) : null,
      endTime: dto.endTime ? new Date(dto.endTime) : null,
      cardNo: dto.cardNo ?? null,
      pin: dto.pin ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      externalUserId: dto.externalUserId ?? null,
      scheduleId: dto.scheduleId ?? null,
      position: dto.position ?? null,
      baseSalary: dto.baseSalary ?? null,
    };

    // Avto-generate yoki user kiritgan qiymat bilan saqlaymiz.
    // Bir vaqtda 2 admin qo'shsa unique constraint bilan konflikt bo'lishi mumkin —
    // shu uchun avto-rejimda retry, qo'lda kiritilganda mappingli xabar.
    const saved = userProvided
      ? await this.saveWithUniqueMapping(
          this.personRepo.create({
            ...baseFields,
            employeeNo: dto.employeeNo!.trim(),
          }),
        )
      : await this.savePersonWithAutoEmployeeNo(companyId, baseFields);

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
    this.audit.log({
      current,
      action: 'person.create',
      entityType: 'person',
      entityId: saved.id,
      companyId: saved.companyId,
      details: { name: saved.name, employeeNo: saved.employeeNo },
    });
    return saved;
  }

  /**
   * Avto-generatsiya: kampaniya ichidagi eng katta raqamli employeeNo + 1.
   * Race condition'ni unique constraint xatolikini ushlash bilan hal qilamiz.
   */
  private async savePersonWithAutoEmployeeNo(
    companyId: string,
    baseFields: Record<string, any>,
  ): Promise<PersonEntity> {
    const MAX_ATTEMPTS = 5;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const employeeNo = await this.nextEmployeeNo(companyId);
      try {
        return await this.personRepo.save(
          this.personRepo.create({ ...baseFields, employeeNo }),
        );
      } catch (e) {
        const pg = e as { code?: string; constraint?: string };
        // Faqat employeeNo unique konfliktida retry qilamiz. cardNo/pin
        // konflikti — foydalanuvchi xatosi, tushunarli xabar bilan to'xtaymiz.
        if (pg?.code === '23505') {
          if (pg.constraint?.includes('employee')) {
            lastErr = e;
            this.logger.warn(
              `employeeNo race, retry ${attempt + 1}/${MAX_ATTEMPTS}`,
            );
            continue;
          }
          if (pg.constraint?.includes('card')) {
            throw new ConflictException(
              `Karta raqami band — boshqa hodimga biriktirilgan`,
            );
          }
          if (pg.constraint?.includes('pin')) {
            throw new ConflictException(
              `PIN band — boshqa hodimga biriktirilgan`,
            );
          }
        }
        throw e;
      }
    }
    throw lastErr ?? new Error('employeeNo avto-generatsiya muvaffaqiyatsiz');
  }

  /**
   * Person'ni saqlashda 23505 (unique violation)'ni constraint nomidan
   * tushunarli ConflictException'ga aylantiradi. Aks holda Postgres xatosi
   * 500 sifatida chiqib, foydalanuvchi sababini tushunmaydi.
   *
   * Constraint nomlari person.entity'da:
   *   - uniq_company_employee → employeeNo
   *   - uniq_company_card     → cardNo
   *   - uniq_company_pin      → pin
   */
  private async saveWithUniqueMapping(
    person: PersonEntity,
  ): Promise<PersonEntity> {
    try {
      return await this.personRepo.save(person);
    } catch (e) {
      const pg = e as { code?: string; constraint?: string; detail?: string };
      if (pg?.code !== '23505') throw e;
      if (pg.constraint?.includes('card')) {
        throw new ConflictException(
          `Karta raqami band — boshqa hodimga biriktirilgan`,
        );
      }
      if (pg.constraint?.includes('pin')) {
        throw new ConflictException(`PIN band — boshqa hodimga biriktirilgan`);
      }
      if (pg.constraint?.includes('employee')) {
        throw new ConflictException(`Tabel raqami band`);
      }
      throw new ConflictException(pg.detail || 'Unique cheklov buzildi');
    }
  }

  /**
   * Kampaniya ichida shu cardNo bo'shligini tekshirish (CRUD'da).
   * `excludePersonId` — update paytida o'z yozuvini hisobdan tashqarida qoldirish uchun.
   */
  private async assertCardNoFree(
    companyId: string,
    cardNo: string,
    excludePersonId?: string,
  ): Promise<void> {
    const existing = await this.personRepo.findOne({
      where: { companyId, cardNo },
    });
    if (existing && existing.id !== excludePersonId) {
      throw new ConflictException(
        `Karta raqami ${cardNo} ushbu kampaniyada boshqa hodimga (${existing.name}) biriktirilgan`,
      );
    }
  }

  /**
   * Kampaniya ichida shu PIN bo'shligini tekshirish.
   * `excludePersonId` — update paytida o'z yozuvini hisobdan tashqarida qoldirish uchun.
   */
  private async assertPinFree(
    companyId: string,
    pin: string,
    excludePersonId?: string,
  ): Promise<void> {
    const existing = await this.personRepo.findOne({
      where: { companyId, pin },
    });
    if (existing && existing.id !== excludePersonId) {
      throw new ConflictException(
        `PIN ${pin} ushbu kampaniyada boshqa hodimga (${existing.name}) biriktirilgan`,
      );
    }
  }

  /**
   * Kampaniya ichidagi keyingi raqamli employeeNo'ni topadi.
   * Faqat sof raqamli (^[0-9]+$) employeeNo'larni hisoblaydi — alfanumerik (masalan "AAA-23")
   * qiymatlar e'tiborsiz qoldiriladi. Default boshlang'ich: 1001.
   */
  async nextEmployeeNo(companyId: string): Promise<string> {
    const row: { max: string | null } | undefined = await this.personRepo
      .createQueryBuilder('p')
      .select(`COALESCE(MAX(CAST(p."employeeNo" AS BIGINT)), 1000)`, 'max')
      .where('p."companyId" = :cid', { cid: companyId })
      .andWhere(`p."employeeNo" ~ '^[0-9]+$'`)
      .getRawOne();
    const maxNum = row?.max ? Number.parseInt(String(row.max), 10) : 1000;
    return String(maxNum + 1);
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

    if (dto.cardNo !== undefined && dto.cardNo !== p.cardNo) {
      const trimmed = dto.cardNo?.trim();
      if (trimmed && p.companyId) {
        await this.assertCardNoFree(p.companyId, trimmed, p.id);
      }
    }

    if (dto.pin !== undefined && dto.pin !== p.pin) {
      const trimmed = dto.pin?.trim();
      if (trimmed && p.companyId) {
        await this.assertPinFree(p.companyId, trimmed, p.id);
      }
    }

    Object.assign(p, {
      name: dto.name ?? p.name,
      userType: dto.userType ?? p.userType,
      gender: dto.gender ?? p.gender,
      beginTime: dto.beginTime ? new Date(dto.beginTime) : p.beginTime,
      endTime: dto.endTime ? new Date(dto.endTime) : p.endTime,
      cardNo: dto.cardNo ?? p.cardNo,
      pin: dto.pin ?? p.pin,
      phone: dto.phone ?? p.phone,
      email: dto.email ?? p.email,
      externalUserId: dto.externalUserId ?? p.externalUserId,
      scheduleId: dto.scheduleId ?? p.scheduleId,
      position: dto.position ?? p.position,
      baseSalary: dto.baseSalary ?? p.baseSalary,
    });
    const saved = await this.saveWithUniqueMapping(p);

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
        await this.deletePersonFromDevice(link.deviceId, p.employeeNo);
        removedFrom.push(link.deviceId);
      } catch (e) {
        failures.push(`${link.deviceId}: ${(e as Error).message}`);
      }
    }

    if (p.faceImagePath) {
      await fs.unlink(p.faceImagePath).catch(() => undefined);
    }
    const employeeNo = p.employeeNo;
    const name = p.name;
    const companyId = p.companyId;
    await this.personRepo.remove(p);
    this.audit.log({
      current,
      action: 'person.delete',
      entityType: 'person',
      entityId: id,
      companyId,
      details: { name, employeeNo, removedFromDevices: removedFrom.length },
    });
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

    // Cheklov: 10MB. Jimp katta yoki bo'zilgan tasvirda OOM qila oladi.
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Bo\'sh fayl yuborildi');
    }
    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException(
        `Rasm hajmi 10MB dan oshmasligi kerak (${Math.round(fileBuffer.length / 1024)}KB)`,
      );
    }
    // Magic bytes check — JPEG (FF D8) yoki PNG (89 50 4E 47).
    const isJpeg = fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8;
    const isPng =
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47;
    if (!isJpeg && !isPng) {
      throw new BadRequestException('Faqat JPEG yoki PNG qabul qilinadi');
    }

    let img;
    try {
      img = await Jimp.read(fileBuffer);
    } catch (e) {
      throw new BadRequestException(
        `Rasmni o'qib bo'lmadi (bo'zilgan fayl): ${(e as Error).message}`,
      );
    }
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
    await this.deletePersonFromDevice(deviceId, p.employeeNo);
    await this.linkRepo.delete({ personId: p.id, deviceId });
  }

  private async deletePersonFromDevice(
    deviceId: string,
    employeeNo: string,
  ): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new Error(`device ${deviceId} topilmadi`);

    if (device.agentId && this.agentsGateway.isAgentOnline(device.agentId)) {
      await this.agentsGateway.sendCommand(deviceId, 'deletePerson', {
        employeeNo,
      });
      return;
    }
    if (device.agentId) {
      throw new Error(`agent ${device.agentId} ulanmagan`);
    }
    const client = await this.devicesService.getClient(deviceId);
    await client.deleteFace(employeeNo).catch(() => undefined);
    await client.deleteUser(employeeNo);
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
      ...(p.pin ? { password: p.pin } : {}),
    };
  }
}
