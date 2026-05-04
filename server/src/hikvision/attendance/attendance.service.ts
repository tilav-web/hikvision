import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AttendanceEntity } from '../entities/attendance.entity';
import { AccessEventEntity } from '../entities/access-event.entity';
import { PersonEntity } from '../entities/person.entity';
import { ScheduleEntity } from '../entities/schedule.entity';
import { PenaltyEntity } from '../entities/penalty.entity';
import { AuthUser } from '../../auth/current-user.decorator';
import { HolidaysService } from '../holidays/holidays.service';
import { VacationsService } from '../vacations/vacations.service';

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

interface OutInterval {
  out: Date;
  in: Date;
  minutes: number;
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
    private readonly holidays: HolidaysService,
    private readonly vacations: VacationsService,
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
   * Yangi event keldi → kunlik attendance'ni qaytadan to'liq hisoblaymiz.
   * Lunch logikasi shu yerda qo'llaniladi.
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
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59.999');

    const isHoliday = await this.holidays.isHoliday(event.companyId, date);
    const isOnLeave = await this.vacations.isOnLeave(person.id, date);

    // Shu kunning barcha grant bo'lgan eventlari (vaqt bo'yicha)
    const allEvents = await this.eventRepo.find({
      where: {
        personId: person.id,
        capturedAt: Between(dayStart, dayEnd),
        category: 'accessGranted' as any,
      },
      order: { capturedAt: 'ASC' },
    });

    const sorted = inferDirections(allEvents);

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
        lunchOverstayMinutes: 0,
        workedMinutes: 0,
        status: 'absent',
      });
    }

    const firstIn = sorted.find((e) => e.direction === 'in');
    const lastOut = [...sorted].reverse().find((e) => e.direction === 'out');
    row.firstInAt = firstIn ? new Date(firstIn.capturedAt) : null;
    row.lastOutAt = lastOut ? new Date(lastOut.capturedAt) : null;

    const sched = person.scheduleId
      ? await this.scheduleRepo.findOne({ where: { id: person.scheduleId } })
      : null;

    if (sched && row.firstInAt) {
      const expectedStart = parseHHMM(sched.startTime, dayStart);
      const expectedEnd = parseHHMM(sched.endTime, dayStart);

      const lateRaw = diffMinutes(row.firstInAt, expectedStart);
      row.lateMinutes = Math.max(0, lateRaw - sched.graceMinutes);

      if (row.lastOutAt) {
        const earlyRaw = diffMinutes(expectedEnd, row.lastOutAt);
        row.earlyLeaveMinutes = Math.max(0, earlyRaw);
      } else {
        row.earlyLeaveMinutes = 0;
      }

      row.lunchOverstayMinutes = computeLunchOverstay(
        sorted,
        sched,
        expectedStart,
        expectedEnd,
      );
    } else {
      row.lateMinutes = 0;
      row.earlyLeaveMinutes = 0;
      row.lunchOverstayMinutes = 0;
    }

    if (row.firstInAt && row.lastOutAt) {
      row.workedMinutes = Math.max(
        0,
        diffMinutes(row.lastOutAt, row.firstInAt) - row.lunchOverstayMinutes,
      );
    } else {
      row.workedMinutes = 0;
    }

    row.status = this.computeStatus(row, { isHoliday, isOnLeave });
    const saved = await this.repo.save(row);

    // Bayram yoki ta'tilda bo'lsa avtomatik jarima yozilmaydi
    if (sched && !isHoliday && !isOnLeave) {
      await this.upsertAutoPenalty(saved, sched);
    } else {
      await this.penaltyRepo.delete({ attendanceId: saved.id });
    }
  }

  private computeStatus(
    row: AttendanceEntity,
    flags: { isHoliday: boolean; isOnLeave: boolean },
  ): AttendanceEntity['status'] {
    if (flags.isHoliday) return 'holiday';
    if (flags.isOnLeave) return 'leave';
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

    await this.penaltyRepo.delete({ attendanceId: row.id });

    if (penaltyRate > 0 && row.lateMinutes >= sched.lateThresholdMinutes) {
      await this.penaltyRepo.save(
        this.penaltyRepo.create({
          companyId: row.companyId,
          personId: row.personId,
          date: row.date,
          type: 'penalty',
          kind: 'late',
          amount: (row.lateMinutes * penaltyRate).toFixed(2),
          reason: `${row.lateMinutes} daq kechikish`,
          attendanceId: row.id,
        }),
      );
    }

    if (
      penaltyRate > 0 &&
      row.earlyLeaveMinutes >= sched.earlyLeaveThresholdMinutes
    ) {
      await this.penaltyRepo.save(
        this.penaltyRepo.create({
          companyId: row.companyId,
          personId: row.personId,
          date: row.date,
          type: 'penalty',
          kind: 'early_leave',
          amount: (row.earlyLeaveMinutes * penaltyRate).toFixed(2),
          reason: `${row.earlyLeaveMinutes} daq erta ketdi`,
          attendanceId: row.id,
        }),
      );
    }

    if (penaltyRate > 0 && row.lunchOverstayMinutes > 0) {
      await this.penaltyRepo.save(
        this.penaltyRepo.create({
          companyId: row.companyId,
          personId: row.personId,
          date: row.date,
          type: 'penalty',
          kind: 'manual',
          amount: (row.lunchOverstayMinutes * penaltyRate).toFixed(2),
          reason: `Tushlikdan ortiq ${row.lunchOverstayMinutes} daq`,
          attendanceId: row.id,
        }),
      );
    }

    if (bonusRate > 0 && row.firstInAt && row.lateMinutes === 0) {
      const baseDate = new Date(row.date + 'T00:00:00');
      const expectedStart = parseHHMM(sched.startTime, baseDate);
      const earlyArrival = Math.max(0, diffMinutes(expectedStart, row.firstInAt));
      if (earlyArrival > 0) {
        await this.penaltyRepo.save(
          this.penaltyRepo.create({
            companyId: row.companyId,
            personId: row.personId,
            date: row.date,
            type: 'bonus',
            kind: 'early_arrival',
            amount: (earlyArrival * bonusRate).toFixed(2),
            reason: `${earlyArrival} daq erta keldi`,
            attendanceId: row.id,
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
    const totalLunchOverstay = rows.reduce(
      (s, r) => s + r.lunchOverstayMinutes,
      0,
    );

    return {
      total,
      present,
      late,
      absent,
      partial,
      totalLateMinutes,
      totalLunchOverstay,
    };
  }
}

// ─── Utility funksiyalari ──────────────────────────────────────────────

interface DirectedEvent {
  capturedAt: Date | string;
  direction: 'in' | 'out';
}

function inferDirections(events: AccessEventEntity[]): DirectedEvent[] {
  let nextExpected: 'in' | 'out' = 'in';
  return events.map((e) => {
    let dir: 'in' | 'out';
    if (e.direction === 'in' || e.direction === 'out') {
      dir = e.direction;
    } else {
      dir = nextExpected;
    }
    nextExpected = dir === 'in' ? 'out' : 'in';
    return { capturedAt: e.capturedAt, direction: dir };
  });
}

/**
 * Lunch rejimlari:
 *  - none: ish vaqti ichidagi har out-in oralig'i jarima sifatida hisoblanadi
 *  - fixed: lunchStart..lunchEnd oralig'idan tashqaridagi out-in jarima
 *  - flexible: barcha out-in oralig'lari yig'iladi, lunchDurationMinutes dan oshgani jarima
 */
function computeLunchOverstay(
  events: DirectedEvent[],
  sched: ScheduleEntity,
  workStart: Date,
  workEnd: Date,
): number {
  const intervals = extractOutIntervals(events);
  if (intervals.length === 0) return 0;

  const inWork = intervals
    .map((iv) => clipInterval(iv, workStart, workEnd))
    .filter((iv): iv is OutInterval => iv !== null);

  if (sched.lunchMode === 'none') {
    return inWork.reduce((s, iv) => s + iv.minutes, 0);
  }

  if (sched.lunchMode === 'fixed' && sched.lunchStart && sched.lunchEnd) {
    const lunchStart = parseHHMM(sched.lunchStart, workStart);
    const lunchEnd = parseHHMM(sched.lunchEnd, workStart);
    let overstay = 0;
    for (const iv of inWork) {
      overstay += subtractInterval(iv, lunchStart, lunchEnd);
    }
    return overstay;
  }

  if (sched.lunchMode === 'flexible') {
    const total = inWork.reduce((s, iv) => s + iv.minutes, 0);
    const budget = sched.lunchDurationMinutes ?? 0;
    return Math.max(0, total - budget);
  }

  return 0;
}

function extractOutIntervals(events: DirectedEvent[]): OutInterval[] {
  const result: OutInterval[] = [];
  let lastOut: Date | null = null;
  for (const e of events) {
    const t = e.capturedAt instanceof Date ? e.capturedAt : new Date(e.capturedAt);
    if (e.direction === 'out') {
      lastOut = t;
    } else if (e.direction === 'in' && lastOut) {
      result.push({
        out: lastOut,
        in: t,
        minutes: Math.max(0, diffMinutes(t, lastOut)),
      });
      lastOut = null;
    }
  }
  return result;
}

function clipInterval(
  iv: OutInterval,
  start: Date,
  end: Date,
): OutInterval | null {
  const out = iv.out < start ? start : iv.out;
  const in_ = iv.in > end ? end : iv.in;
  if (out >= in_) return null;
  return { out, in: in_, minutes: diffMinutes(in_, out) };
}

/** Interval ichidan [from..to] qismini olib tashlab, qolgan daqiqalar yig'indisini qaytaradi. */
function subtractInterval(iv: OutInterval, from: Date, to: Date): number {
  if (iv.in <= from || iv.out >= to) return iv.minutes;
  let total = 0;
  if (iv.out < from) total += diffMinutes(from, iv.out);
  if (iv.in > to) total += diffMinutes(iv.in, to);
  return total;
}
