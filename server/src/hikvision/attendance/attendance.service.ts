import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AttendanceEntity } from '../entities/attendance.entity';
import { AccessEventEntity } from '../entities/access-event.entity';
import { PersonEntity } from '../entities/person.entity';
import { ScheduleEntity } from '../entities/schedule.entity';
import { PenaltyEntity } from '../entities/penalty.entity';
import { AuthUser } from '../../auth/current-user.decorator';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function dateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseHHMM(hhmm: string, baseDate: Date): Date {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const out = new Date(baseDate);
  out.setHours(h, m, 0, 0);
  return out;
}

function diffMinutes(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly repo: Repository<AttendanceEntity>,
    @InjectRepository(AccessEventEntity)
    private readonly eventRepo: Repository<AccessEventEntity>,
    @InjectRepository(PersonEntity)
    private readonly personRepo: Repository<PersonEntity>,
    @InjectRepository(ScheduleEntity)
    private readonly scheduleRepo: Repository<ScheduleEntity>,
    @InjectRepository(PenaltyEntity)
    private readonly penaltyRepo: Repository<PenaltyEntity>,
  ) {}

  async list(opts: {
    current: AuthUser;
    companyId?: string;
    personId?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.personId) where.personId = opts.personId;
    if (opts.from && opts.to) where.date = Between(opts.from, opts.to);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { date: 'DESC' },
      relations: { person: true },
      skip: opts.skip ?? 0,
      take: opts.take ?? 100,
    });
    return { items, total };
  }

  /**
   * Yangi event keldi → kunlik attendance'ni yangilaymiz.
   * Ushbu metod EventsService ichidan chaqiriladi (har 'in'/'out' event'da).
   */
  async ingestEvent(event: AccessEventEntity): Promise<void> {
    if (!event.personId || !event.companyId) return;
    if (event.category !== 'accessGranted') return;

    const person = await this.personRepo.findOne({
      where: { id: event.personId },
    });
    if (!person) return;

    const captured = new Date(event.capturedAt);
    const date = dateString(captured);

    let row = await this.repo.findOne({
      where: { personId: person.id, date },
    });

    if (!row) {
      row = this.repo.create({
        companyId: event.companyId,
        personId: person.id,
        scheduleId: person.scheduleId,
        date,
        firstInAt: null,
        lastOutAt: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        workedMinutes: 0,
        status: 'absent',
      });
    }

    if (event.direction === 'in') {
      if (!row.firstInAt || captured < row.firstInAt) {
        row.firstInAt = captured;
      }
    } else if (event.direction === 'out') {
      if (!row.lastOutAt || captured > row.lastOutAt) {
        row.lastOutAt = captured;
      }
    } else {
      // direction null (both rejimida tugma bosilmagan) — birinchi event = in, keyingilari = out
      if (!row.firstInAt) {
        row.firstInAt = captured;
      } else {
        row.lastOutAt = captured;
      }
    }

    // Schedule asosida kechikish va workedMinutes
    if (person.scheduleId) {
      const sched = await this.scheduleRepo.findOne({
        where: { id: person.scheduleId },
      });
      if (sched) {
        await this.applySchedule(row, sched);
      }
    }

    if (row.firstInAt && row.lastOutAt) {
      row.workedMinutes = Math.max(0, diffMinutes(row.lastOutAt, row.firstInAt));
    }

    row.status = this.computeStatus(row);
    await this.repo.save(row);

    // Auto-jarima/mukofot
    if (person.scheduleId) {
      const sched = await this.scheduleRepo.findOne({
        where: { id: person.scheduleId },
      });
      if (sched) await this.upsertAutoPenalty(row, sched);
    }
  }

  private async applySchedule(
    row: AttendanceEntity,
    sched: ScheduleEntity,
  ): Promise<void> {
    if (!row.firstInAt) return;
    const baseDate = new Date(row.date + 'T00:00:00');
    const expectedStart = parseHHMM(sched.startTime, baseDate);
    const expectedEnd = parseHHMM(sched.endTime, baseDate);

    const lateRaw = diffMinutes(row.firstInAt, expectedStart);
    const lateAfterGrace = Math.max(0, lateRaw - sched.graceMinutes);
    row.lateMinutes = lateAfterGrace;

    if (row.lastOutAt) {
      const earlyRaw = diffMinutes(expectedEnd, row.lastOutAt);
      row.earlyLeaveMinutes = Math.max(0, earlyRaw);
    }
  }

  private computeStatus(row: AttendanceEntity): AttendanceEntity['status'] {
    if (!row.firstInAt) return 'absent';
    if (row.lateMinutes > 0) return 'late';
    if (!row.lastOutAt) return 'partial';
    return 'present';
  }

  private async upsertAutoPenalty(
    row: AttendanceEntity,
    sched: ScheduleEntity,
  ): Promise<void> {
    const penaltyRate = parseFloat(sched.penaltyPerLateMinute);
    const bonusRate = parseFloat(sched.bonusPerEarlyMinute);

    // Avvalgi auto-yozuvlarni o'chirib, qayta yaratamiz (idempotent)
    await this.penaltyRepo.delete({
      attendanceId: row.id,
    });

    if (penaltyRate > 0 && row.lateMinutes >= sched.lateThresholdMinutes) {
      const amount = (row.lateMinutes * penaltyRate).toFixed(2);
      await this.penaltyRepo.save(
        this.penaltyRepo.create({
          companyId: row.companyId,
          personId: row.personId,
          date: row.date,
          type: 'penalty',
          kind: 'late',
          amount,
          reason: `${row.lateMinutes} daqiqa kechikish`,
          attendanceId: row.id,
          createdByUserId: null,
        }),
      );
    }

    if (
      bonusRate > 0 &&
      row.firstInAt &&
      row.lateMinutes === 0
    ) {
      const baseDate = new Date(row.date + 'T00:00:00');
      const expectedStart = parseHHMM(sched.startTime, baseDate);
      const earlyArrival = Math.max(
        0,
        diffMinutes(expectedStart, row.firstInAt),
      );
      if (earlyArrival > 0) {
        const amount = (earlyArrival * bonusRate).toFixed(2);
        await this.penaltyRepo.save(
          this.penaltyRepo.create({
            companyId: row.companyId,
            personId: row.personId,
            date: row.date,
            type: 'bonus',
            kind: 'early_arrival',
            amount,
            reason: `${earlyArrival} daqiqa erta keldi`,
            attendanceId: row.id,
            createdByUserId: null,
          }),
        );
      }
    }
  }

  async stats(opts: {
    current: AuthUser;
    companyId?: string;
    from?: string;
    to?: string;
  }) {
    const where: any = {};
    if (opts.current.role === 'company_admin') {
      where.companyId = opts.current.companyId;
    } else if (opts.companyId) {
      where.companyId = opts.companyId;
    }
    if (opts.from && opts.to) where.date = Between(opts.from, opts.to);

    const rows = await this.repo.find({ where });
    const total = rows.length;
    const present = rows.filter((r) => r.status === 'present').length;
    const late = rows.filter((r) => r.status === 'late').length;
    const absent = rows.filter((r) => r.status === 'absent').length;
    const partial = rows.filter((r) => r.status === 'partial').length;
    const totalLateMinutes = rows.reduce((s, r) => s + r.lateMinutes, 0);

    return { total, present, late, absent, partial, totalLateMinutes };
  }
}
