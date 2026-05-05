import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity } from '../entities/device.entity';
import { PersonEntity } from '../entities/person.entity';
import { PersonDeviceEntity } from '../entities/person-device.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { AgentsGateway } from '../agents/agents.gateway';
import { DevicesService } from './devices.service';
import { PersonsService } from '../persons/persons.service';

/** Aparatdan kelgan user — sodda ko'rinishda. */
export interface DeviceUser {
  employeeNo: string;
  name: string;
  userType: string | null;
  gender: 'male' | 'female' | 'unknown';
  cardNo: string | null;
  beginTime: string | null;
  endTime: string | null;
  raw: any;
}

/** Solishtirish natijalari. */
export interface CompareResult {
  deviceId: string;
  companyId: string | null;
  total: { device: number; db: number };
  onlyOnDevice: DeviceUser[];
  onlyInDb: Array<{
    id: string;
    employeeNo: string;
    name: string;
    cardNo: string | null;
  }>;
  matched: Array<{ employeeNo: string; name: string; personId: string }>;
  mismatched: Array<{
    employeeNo: string;
    deviceUser: DeviceUser;
    dbPerson: { id: string; name: string; cardNo: string | null };
    diffs: string[];
  }>;
}

/**
 * Aparat ↔ DB userlarini solishtirish va sinxronlash xizmati.
 *
 *  - enumerateOnDevice: aparat'dagi barcha userlar
 *  - compare: device vs DB diff (only-device, only-db, mismatched)
 *  - importFromDevice: tanlangan device userlarni DB'ga yozish
 *  - pushToDevice: tanlangan DB personlarni aparatga yuborish
 *  - deleteFromDevice: faqat aparat'dan o'chirish (DB tegmaydi)
 *  - checkPersonOnDevice: bitta person bitta qurilmada bormi (Sprint 3)
 */
@Injectable()
export class DeviceSyncService {
  private readonly logger = new Logger(DeviceSyncService.name);

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
    @InjectRepository(PersonDeviceEntity)
    private readonly linkRepo: Repository<PersonDeviceEntity>,
    private readonly agentsGateway: AgentsGateway,
    private readonly devicesService: DevicesService,
    private readonly personsService: PersonsService,
  ) {}

  // ───── Aparat'dan o'qish ─────

  async enumerateOnDevice(
    current: AuthUser,
    deviceId: string,
  ): Promise<DeviceUser[]> {
    const device = await this.devicesService.findOne(current, deviceId);
    if (!device.agentId) {
      throw new BadRequestException(
        'qurilma agent bilan bog\'lanmagan — sinxronlash agentsiz mumkin emas',
      );
    }
    if (!this.agentsGateway.isAgentOnline(device.agentId)) {
      throw new BadRequestException('agent ulanmagan');
    }
    const result = await this.agentsGateway.sendCommand<{
      totalMatches: number;
      users: any[];
    }>(deviceId, 'enumerateUsers', { pageSize: 30 }, 60_000);
    return (result.users ?? []).map(normalizeDeviceUser);
  }

  // ───── Diff ─────

  async compare(current: AuthUser, deviceId: string): Promise<CompareResult> {
    const device = await this.devicesService.findOne(current, deviceId);
    const deviceUsers = await this.enumerateOnDevice(current, deviceId);
    const dbPersons = device.companyId
      ? await this.personRepo.find({
          where: { companyId: device.companyId },
          select: ['id', 'employeeNo', 'name', 'cardNo'],
        })
      : [];

    const deviceMap = new Map(deviceUsers.map((u) => [u.employeeNo, u]));
    const dbMap = new Map(dbPersons.map((p) => [p.employeeNo, p]));

    const onlyOnDevice: DeviceUser[] = [];
    const onlyInDb: CompareResult['onlyInDb'] = [];
    const matched: CompareResult['matched'] = [];
    const mismatched: CompareResult['mismatched'] = [];

    for (const [empNo, du] of deviceMap) {
      const dbp = dbMap.get(empNo);
      if (!dbp) {
        onlyOnDevice.push(du);
        continue;
      }
      const diffs = computeDiffs(du, dbp);
      if (diffs.length === 0) {
        matched.push({ employeeNo: empNo, name: dbp.name, personId: dbp.id });
      } else {
        mismatched.push({
          employeeNo: empNo,
          deviceUser: du,
          dbPerson: { id: dbp.id, name: dbp.name, cardNo: dbp.cardNo },
          diffs,
        });
      }
    }
    for (const [empNo, dbp] of dbMap) {
      if (!deviceMap.has(empNo)) {
        onlyInDb.push({
          id: dbp.id,
          employeeNo: empNo,
          name: dbp.name,
          cardNo: dbp.cardNo,
        });
      }
    }

    return {
      deviceId,
      companyId: device.companyId,
      total: { device: deviceUsers.length, db: dbPersons.length },
      onlyOnDevice,
      onlyInDb,
      matched,
      mismatched,
    };
  }

  // ───── Aparat'dan DB'ga import ─────

  async importFromDevice(
    current: AuthUser,
    deviceId: string,
    employeeNos: string[],
  ): Promise<{
    created: Array<{ id: string; employeeNo: string; name: string }>;
    skipped: Array<{ employeeNo: string; reason: string }>;
  }> {
    const device = await this.devicesService.findOne(current, deviceId);
    if (!device.companyId) {
      throw new BadRequestException(
        'qurilmaga kampaniya biriktirilmagan — import qilib bo\'lmaydi',
      );
    }

    const allUsers = await this.enumerateOnDevice(current, deviceId);
    const wanted = new Set(employeeNos);
    const target = allUsers.filter((u) => wanted.has(u.employeeNo));

    const created: Array<{ id: string; employeeNo: string; name: string }> = [];
    const skipped: Array<{ employeeNo: string; reason: string }> = [];

    for (const u of target) {
      try {
        const existing = await this.personRepo.findOne({
          where: { companyId: device.companyId, employeeNo: u.employeeNo },
        });
        if (existing) {
          skipped.push({
            employeeNo: u.employeeNo,
            reason: 'DB\'da allaqachon mavjud',
          });
          continue;
        }
        const person = this.personRepo.create({
          companyId: device.companyId,
          employeeNo: u.employeeNo,
          name: u.name || `Employee ${u.employeeNo}`,
          userType: normalizeUserType(u.userType),
          gender: u.gender,
          cardNo: u.cardNo,
          beginTime: u.beginTime ? new Date(u.beginTime) : null,
          endTime: u.endTime ? new Date(u.endTime) : null,
          phone: null,
          email: null,
          externalUserId: null,
          scheduleId: null,
          position: null,
          baseSalary: null,
          isActive: true,
        });
        const saved = await this.personRepo.save(person);
        // Link bilan belgilash — bu qurilmada mavjud (synced)
        await this.linkRepo.save(
          this.linkRepo.create({
            personId: saved.id,
            deviceId,
            status: 'synced',
            syncedAt: new Date(),
          }),
        );
        created.push({
          id: saved.id,
          employeeNo: saved.employeeNo,
          name: saved.name,
        });
      } catch (e) {
        skipped.push({
          employeeNo: u.employeeNo,
          reason: (e as Error).message,
        });
      }
    }
    this.logger.log(
      `import ${deviceId}: ${created.length} qo'shildi, ${skipped.length} skipped`,
    );
    return { created, skipped };
  }

  // ───── DB'dan aparat'ga push ─────

  async pushToDevice(
    current: AuthUser,
    deviceId: string,
    personIds: string[],
  ): Promise<{
    success: Array<{ personId: string; employeeNo: string }>;
    failed: Array<{ personId: string; error: string }>;
  }> {
    const device = await this.devicesService.findOne(current, deviceId);
    const success: Array<{ personId: string; employeeNo: string }> = [];
    const failed: Array<{ personId: string; error: string }> = [];

    for (const personId of personIds) {
      try {
        const person = await this.personRepo.findOne({
          where: { id: personId },
        });
        if (!person) throw new NotFoundException('person topilmadi');
        if (
          current.role === 'company_admin' &&
          person.companyId !== current.companyId
        ) {
          throw new BadRequestException('boshqa kampaniya hodimi');
        }
        if (
          device.companyId &&
          person.companyId !== device.companyId
        ) {
          throw new BadRequestException(
            'person va qurilma turli kampaniyalarga tegishli',
          );
        }
        // Link mavjud bo'lmasa yaratamiz
        let link = await this.linkRepo.findOne({
          where: { personId, deviceId },
        });
        if (!link) {
          link = await this.linkRepo.save(
            this.linkRepo.create({
              personId,
              deviceId,
              status: 'pending',
            }),
          );
        }
        await this.personsService.syncOne(person, deviceId);
        success.push({ personId, employeeNo: person.employeeNo });
      } catch (e) {
        failed.push({ personId, error: (e as Error).message });
      }
    }
    return { success, failed };
  }

  // ───── Aparat'dan o'chirish (DB tegmaydi) ─────

  async deleteFromDevice(
    current: AuthUser,
    deviceId: string,
    employeeNos: string[],
  ): Promise<{
    success: string[];
    failed: Array<{ employeeNo: string; error: string }>;
  }> {
    const device = await this.devicesService.findOne(current, deviceId);
    if (!device.agentId) {
      throw new BadRequestException('qurilma agent bilan bog\'lanmagan');
    }

    const success: string[] = [];
    const failed: Array<{ employeeNo: string; error: string }> = [];
    for (const employeeNo of employeeNos) {
      try {
        await this.agentsGateway.sendCommand(
          deviceId,
          'deletePerson',
          { employeeNo },
          15_000,
        );
        success.push(employeeNo);
      } catch (e) {
        failed.push({ employeeNo, error: (e as Error).message });
      }
    }
    return { success, failed };
  }

  // ───── Sprint 3: Person sync status (per-device) ─────

  async checkPersonOnDevices(
    current: AuthUser,
    personId: string,
  ): Promise<
    Array<{
      deviceId: string;
      deviceName: string;
      isLinked: boolean;
      linkStatus: string | null;
      onDevice: boolean | 'unknown';
      error: string | null;
    }>
  > {
    const person = await this.personRepo.findOne({
      where: { id: personId },
    });
    if (!person) throw new NotFoundException('person topilmadi');
    if (
      current.role === 'company_admin' &&
      person.companyId !== current.companyId
    ) {
      throw new BadRequestException('boshqa kampaniya hodimi');
    }

    if (!person.companyId) return [];

    // Kampaniya'ning barcha qurilmalari + person uchun mavjud link'lar
    const devices = await this.deviceRepo.find({
      where: { companyId: person.companyId },
    });
    const links = await this.linkRepo.find({ where: { personId } });
    const linkMap = new Map(links.map((l) => [l.deviceId, l]));

    const results: Array<{
      deviceId: string;
      deviceName: string;
      isLinked: boolean;
      linkStatus: string | null;
      onDevice: boolean | 'unknown';
      error: string | null;
    }> = [];

    for (const device of devices) {
      const link = linkMap.get(device.id) ?? null;
      const result: {
        deviceId: string;
        deviceName: string;
        isLinked: boolean;
        linkStatus: string | null;
        onDevice: boolean | 'unknown';
        error: string | null;
      } = {
        deviceId: device.id,
        deviceName: device.name,
        isLinked: !!link,
        linkStatus: link?.status ?? null,
        onDevice: 'unknown',
        error: null,
      };

      // Qurilma agentsiz yoki agent offline bo'lsa onDevice='unknown'
      if (!device.agentId || !this.agentsGateway.isAgentOnline(device.agentId)) {
        result.error = 'agent ulanmagan';
        results.push(result);
        continue;
      }
      try {
        const search = await this.agentsGateway.sendCommand<{
          totalMatches: number;
          users: any[];
        }>(
          device.id,
          'searchUser',
          { employeeNo: person.employeeNo, maxResults: 1 },
          10_000,
        );
        result.onDevice = (search.totalMatches ?? 0) > 0;
      } catch (e) {
        result.error = (e as Error).message;
      }
      results.push(result);
    }
    return results;
  }
}

// ───── helper'lar ─────

function normalizeDeviceUser(u: any): DeviceUser {
  return {
    employeeNo: String(u.employeeNo ?? '').trim(),
    name: String(u.name ?? '').trim(),
    userType: u.userType ? String(u.userType) : null,
    gender: normalizeGender(u.gender),
    cardNo: u.cardNo ? String(u.cardNo) : null,
    beginTime: u.Valid?.beginTime ? String(u.Valid.beginTime) : null,
    endTime: u.Valid?.endTime ? String(u.Valid.endTime) : null,
    raw: u,
  };
}

function normalizeGender(g: any): 'male' | 'female' | 'unknown' {
  const v = String(g ?? '').toLowerCase();
  if (v === 'male' || v === 'female') return v;
  return 'unknown';
}

function normalizeUserType(t: string | null): PersonEntity['userType'] {
  const allowed: PersonEntity['userType'][] = [
    'normal',
    'visitor',
    'blackList',
    'patient',
    'maintenance',
  ];
  const v = String(t ?? '').trim() as PersonEntity['userType'];
  return allowed.includes(v) ? v : 'normal';
}

function computeDiffs(
  du: DeviceUser,
  dbp: { name: string; cardNo: string | null },
): string[] {
  const diffs: string[] = [];
  if (du.name && dbp.name && du.name !== dbp.name) diffs.push('name');
  if ((du.cardNo ?? null) !== (dbp.cardNo ?? null)) diffs.push('cardNo');
  return diffs;
}
