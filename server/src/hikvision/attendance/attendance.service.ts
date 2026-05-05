import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { NotificationsService } from '../../telegram/notifications.service';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Attendance hisob-kitoblari uchun timezone. .env'da TZ_DEFAULT bo'lsa o'sha,
 * bo'lmasa Asia/Tashkent. MUHIM: bu kunlik chegarani aniqlaydi — agar server
 * UTC'da ishlasa, lekin kampaniya UZ'da bo'lsa, 23:30 UTC = 04:30 UZ ertasi kun.
 */
const ATTENDANCE_TZ = process.env.TZ_DEFAULT || 'Asia/Tashkent';

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateString(d: Date): string {
  // 'en-CA' YYYY-MM-DD formatini beradi.
  return dateFmt.format(d);
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

/**
 * Maosh hisobi uchun standart UZ ish kunlari/oy. Schedule yo'q yoki
 * `workingDays` bitmask bo'sh bo'lsa fallback sifatida ishlatiladi.
 */
const STANDARD_WORK_DAYS_PER_MONTH = 22;

function paidDayWeight(status: AttendanceEntity['status']): number {
  if (status === 'absent') return 0;
  if (status === 'partial') return 0.5;
  // present, late, currently_inside, overtime, leave, holiday — to'liq kun
  return 1;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Schedule.workingDays bitmask: dush=1, sesh=2, chor=4, pay=8, juma=16,
 * shanba=32, yakshanba=64. Sana uchun bu kun ish kunimi degan tekshiruv.
 * JS getDay(): 0=yakshanba ... 6=shanba — moslashtiramiz.
 */
const DAY_BITS = [64, 1, 2, 4, 8, 16, 32]; // index = JS getDay()

function isWorkingDay(date: Date, mask: number): boolean {
  return (DAY_BITS[date.getDay()] & mask) !== 0;
}

/** Berilgan oyda shu schedule bo'yicha nechta ish kuni (bayramlar olib tashlanadi). */
function workingDaysInMonth(
  year: number,
  month: number, // 0-based
  mask: number,
  holidays: Set<string>,
): number {
  if (mask === 0) return STANDARD_WORK_DAYS_PER_MONTH;
  const last = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= last; day++) {
    const d = new Date(year, month, day);
    if (!isWorkingDay(d, mask)) continue;
    const ds = `${year}-${pad(month + 1)}-${pad(day)}`;
    if (holidays.has(ds)) continue;
    count++;
  }
  return count || STANDARD_WORK_DAYS_PER_MONTH;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  /**
   * Per-(personId,date) mutex zanjiri: bir hodimning bitta kunini bir vaqtda
   * faqat bitta `recomputeDay` qayta ishlasin (otherwise ikki parallel chaqiriq
   * `attendance` rowini bir-birining ustiga yozadi).
   */
  private readonly dayLocks = new Map<string, Promise<unknown>>();

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
    private readonly notifications: NotificationsService,
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
   * Bitta attendance kunining timeline'i — barcha grant event'lari, har biri uchun
   * direction ko'rsatilgan. Davomat sahifasidagi accordion uchun.
   */
  async dayEvents(
    current: AuthUser,
    attendanceId: string,
  ): Promise<{
    attendance: AttendanceEntity;
    events: Array<{
      id: string;
      capturedAt: Date;
      direction: 'in' | 'out';
      directionSource: string | null;
      verifyMode: string;
      deviceId: string;
      deviceName: string;
    }>;
  }> {
    const row = await this.repo.findOne({
      where: { id: attendanceId },
      relations: { person: true },
    });
    if (!row) {
      throw new NotFoundException('attendance topilmadi');
    }
    if (current.role === 'company_admin' && row.companyId !== current.companyId) {
      throw new ForbiddenException('boshqa kampaniya yozuviga ruxsat yo\'q');
    }

    const dayStart = new Date(row.date + 'T00:00:00');
    const dayEnd = new Date(row.date + 'T23:59:59.999');
    const raw = await this.eventRepo.find({
      where: {
        personId: row.personId,
        capturedAt: Between(dayStart, dayEnd),
        category: 'accessGranted' as any,
      },
      relations: { device: true },
      order: { capturedAt: 'ASC' },
    });
    const directed = inferDirections(raw);

    const events = raw.map((e, idx) => ({
      id: e.id,
      capturedAt: e.capturedAt,
      direction: directed[idx]?.direction ?? 'in',
      directionSource: e.directionSource,
      verifyMode: e.verifyMode,
      deviceId: e.deviceId,
      deviceName: e.device?.name ?? '—',
    }));
    return { attendance: row, events };
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
    await this.recomputeDay(event.companyId, person, date);
  }

  /**
   * Bitta hodim uchun bitta kunni qaytadan hisoblash.
   * ingestEvent va manual recompute uchun ishlatiladi.
   *
   * Per-(person,date) mutex bilan o'ralgan — parallel event'lar duplikat
   * yozuvlarni yaratmaydi.
   */
  async recomputeDay(
    companyId: string,
    person: PersonEntity,
    date: string,
  ): Promise<AttendanceEntity> {
    const key = `${person.id}:${date}`;
    const prev = this.dayLocks.get(key) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(() => this.recomputeDayInternal(companyId, person, date));
    this.dayLocks.set(key, next);
    try {
      return await next;
    } finally {
      // Faqat hozirgi promise oxirgi bo'lsa map'dan olib tashlaymiz.
      if (this.dayLocks.get(key) === next) {
        this.dayLocks.delete(key);
      }
    }
  }

  private async recomputeDayInternal(
    companyId: string,
    person: PersonEntity,
    date: string,
  ): Promise<AttendanceEntity> {
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59.999');

    const isHoliday = await this.holidays.isHoliday(companyId, date);
    const isOnLeave = await this.vacations.isOnLeave(person.id, date);

    const allEvents = await this.eventRepo.find({
      where: {
        personId: person.id,
        capturedAt: Between(dayStart, dayEnd),
        category: 'accessGranted' as any,
      },
      order: { capturedAt: 'ASC' },
    });

    const directed = inferDirections(allEvents);
    const enterCount = directed.filter((e) => e.direction === 'in').length;
    const exitCount = directed.filter((e) => e.direction === 'out').length;

    const sched = person.scheduleId
      ? await this.scheduleRepo.findOne({ where: { id: person.scheduleId } })
      : null;
    const expectedStart = sched ? parseHHMM(sched.startTime, dayStart) : null;
    const expectedEnd = sched ? parseHHMM(sched.endTime, dayStart) : null;

    const today = new Date();
    const isToday = dateString(today) === date;
    const isPast = dayEnd < today;

    // 'in' - 'out' juftliklarini quramiz va yopilmagan oxirgi 'in' uchun qaror qabul qilamiz
    const { intervals, currentlyInside } = pairIntoIntervals(directed, {
      isToday,
      isPast,
      now: today,
      autoCloseAt: expectedEnd ?? dayEnd,
    });

    let row = await this.repo.findOne({
      where: { personId: person.id, date },
    });
    // Notification deduping uchun avvalgi statusni eslab qolamiz —
    // faqat boshqa holatdan 'late' ga o'tganda Telegram bildirishnoma yuborilsin.
    const prevStatus = row?.status ?? 'absent';
    if (!row) {
      row = this.repo.create({
        companyId,
        personId: person.id,
        scheduleId: person.scheduleId,
        date,
        firstInAt: null,
        lastOutAt: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        lunchOverstayMinutes: 0,
        workedMinutes: 0,
        overtimeMinutes: 0,
        earlyArrivalMinutes: 0,
        enterCount: 0,
        exitCount: 0,
        status: 'absent',
      });
    }

    row.enterCount = enterCount;
    row.exitCount = exitCount;
    row.firstInAt = intervals.length > 0 ? intervals[0].in : null;
    // lastOutAt: agar hodim hali ichkarida bo'lsa null, aks holda oxirgi yopilgan interval'ning out vaqti
    row.lastOutAt = currentlyInside
      ? null
      : intervals.length > 0
        ? intervals[intervals.length - 1].out
        : null;

    // Jami ish vaqti = barcha juftliklarning yig'indisi
    const totalPaired = intervals.reduce(
      (s, iv) => s + Math.max(0, diffMinutes(iv.out, iv.in)),
      0,
    );

    // Tushlik overstay'ini eski mantiq bilan hisoblaymiz
    if (sched && expectedStart && expectedEnd) {
      row.lunchOverstayMinutes = computeLunchOverstay(
        directed,
        sched,
        expectedStart,
        expectedEnd,
      );

      if (row.firstInAt) {
        const lateRaw = diffMinutes(row.firstInAt, expectedStart);
        row.lateMinutes = Math.max(0, lateRaw - sched.graceMinutes);

        const earlyArrivalRaw = diffMinutes(expectedStart, row.firstInAt);
        row.earlyArrivalMinutes = Math.max(0, earlyArrivalRaw);
      } else {
        row.lateMinutes = 0;
        row.earlyArrivalMinutes = 0;
      }

      if (row.lastOutAt) {
        const earlyRaw = diffMinutes(expectedEnd, row.lastOutAt);
        row.earlyLeaveMinutes = Math.max(0, earlyRaw);

        const overtimeRaw = diffMinutes(row.lastOutAt, expectedEnd);
        row.overtimeMinutes = Math.max(0, overtimeRaw);
      } else {
        row.earlyLeaveMinutes = 0;
        row.overtimeMinutes = 0;
      }
    } else {
      row.lateMinutes = 0;
      row.earlyLeaveMinutes = 0;
      row.lunchOverstayMinutes = 0;
      row.overtimeMinutes = 0;
      row.earlyArrivalMinutes = 0;
    }

    row.workedMinutes = Math.max(0, totalPaired - row.lunchOverstayMinutes);

    row.status = this.computeStatus(row, {
      isHoliday,
      isOnLeave,
      currentlyInside,
    });
    const saved = await this.repo.save(row);

    if (sched && !isHoliday && !isOnLeave) {
      await this.upsertAutoPenalty(saved, sched);
    } else {
      await this.penaltyRepo.delete({ attendanceId: saved.id });
    }

    // Bildirishnoma — avvalgi status 'late' bo'lmay, hozir 'late' bo'lsa
    // (recomputeDay bir necha marta chaqirilganda duplikat bo'lmasligi uchun)
    if (prevStatus !== 'late' && saved.status === 'late') {
      void this.notifications.dispatch('late', saved.companyId, {
        personName: person.name,
        employeeNo: person.employeeNo,
        lateMinutes: saved.lateMinutes,
        date: saved.date,
      });
    }

    return saved;
  }

  private computeStatus(
    row: AttendanceEntity,
    flags: {
      isHoliday: boolean;
      isOnLeave: boolean;
      currentlyInside: boolean;
    },
  ): AttendanceEntity['status'] {
    if (flags.isHoliday) return 'holiday';
    if (flags.isOnLeave) return 'leave';
    if (!row.firstInAt) return 'absent';
    if (flags.currentlyInside) return 'currently_inside';
    if (!row.lastOutAt) return 'partial';
    if (row.lateMinutes > 0) return 'late';
    if (row.overtimeMinutes > 0) return 'overtime';
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

  /**
   * Bitta hodim uchun to'liq statistika (sana oralig'i bo'yicha):
   *  - Asosiy hisoblar: kunlar (present/late/absent/holiday/leave/...)
   *  - Daqiqa yig'indilari: workedMinutes, lateMinutes, earlyLeaveMinutes,
   *    overtimeMinutes, earlyArrivalMinutes, lunchOverstayMinutes
   *  - Jarima/bonus jami
   *  - Kunlar bo'yicha breakdown
   */
  async personStats(
    current: AuthUser,
    personId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<{
    person: {
      id: string;
      name: string;
      employeeNo: string;
      companyId: string;
      position: string | null;
      baseSalary: string | null;
    };
    range: { from: string; to: string };
    counts: {
      total: number;
      present: number;
      late: number;
      absent: number;
      partial: number;
      leave: number;
      holiday: number;
      currentlyInside: number;
      overtime: number;
    };
    minutes: {
      worked: number;
      late: number;
      earlyLeave: number;
      overtime: number;
      earlyArrival: number;
      lunchOverstay: number;
    };
    money: { totalPenalty: number; totalBonus: number };
    salary: {
      baseMonthly: number;
      dailyRate: number;
      paidDays: number;
      earnedBase: number;
      totalPenalty: number;
      totalBonus: number;
      netPayable: number;
    };
    rows: AttendanceEntity[];
  }> {
    const person = await this.personRepo.findOne({ where: { id: personId } });
    if (!person) throw new NotFoundException('hodim topilmadi');
    if (
      current.role === 'company_admin' &&
      person.companyId !== current.companyId
    ) {
      throw new ForbiddenException('boshqa kampaniya hodimiga ruxsat yo\'q');
    }

    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    const from = opts.from ?? dateString(defaultFrom);
    const to = opts.to ?? dateString(today);

    const rows = await this.repo.find({
      where: { personId, date: Between(from, to) },
      order: { date: 'ASC' },
    });

    const counts = {
      total: rows.length,
      present: rows.filter((r) => r.status === 'present').length,
      late: rows.filter((r) => r.status === 'late').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      partial: rows.filter((r) => r.status === 'partial').length,
      leave: rows.filter((r) => r.status === 'leave').length,
      holiday: rows.filter((r) => r.status === 'holiday').length,
      currentlyInside: rows.filter((r) => r.status === 'currently_inside').length,
      overtime: rows.filter((r) => r.status === 'overtime').length,
    };
    const minutes = {
      worked: rows.reduce((s, r) => s + r.workedMinutes, 0),
      late: rows.reduce((s, r) => s + r.lateMinutes, 0),
      earlyLeave: rows.reduce((s, r) => s + r.earlyLeaveMinutes, 0),
      overtime: rows.reduce((s, r) => s + r.overtimeMinutes, 0),
      earlyArrival: rows.reduce((s, r) => s + r.earlyArrivalMinutes, 0),
      lunchOverstay: rows.reduce((s, r) => s + r.lunchOverstayMinutes, 0),
    };

    const penalties = await this.penaltyRepo.find({
      where: { personId, date: Between(from, to) },
    });
    let totalPenalty = 0;
    let totalBonus = 0;
    for (const p of penalties) {
      const amt = parseFloat(p.amount as unknown as string) || 0;
      if (p.type === 'penalty') totalPenalty += amt;
      else if (p.type === 'bonus') totalBonus += amt;
    }

    // Maosh hisobida ishlatish uchun: hodimning schedule'i va range'dagi bayramlar.
    const schedule = person.scheduleId
      ? await this.scheduleRepo.findOne({ where: { id: person.scheduleId } })
      : null;
    const holidayDates = person.companyId
      ? await this.holidays.datesInRange(person.companyId, from, to)
      : new Set<string>();

    const salary = computeSalarySummary(
      person.baseSalary,
      rows,
      totalPenalty,
      totalBonus,
      schedule,
      holidayDates,
    );

    return {
      person: {
        id: person.id,
        name: person.name,
        employeeNo: person.employeeNo,
        companyId: person.companyId!,
        position: person.position,
        baseSalary: person.baseSalary,
      },
      range: { from, to },
      counts,
      minutes,
      money: { totalPenalty, totalBonus },
      salary,
      rows,
    };
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
    const leave = rows.filter((r) => r.status === 'leave').length;
    const holiday = rows.filter((r) => r.status === 'holiday').length;
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
      leave,
      holiday,
      totalLateMinutes,
      totalLunchOverstay,
    };
  }

  /**
   * Hodimlar bo'yicha jami statistika — har hodim uchun agregat (kechikish daqiqalari, ish daqiqalari).
   */
  async perPerson(opts: {
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

    const rows = await this.repo.find({ where, relations: { person: true } });
    const map = new Map<string, {
      personId: string;
      personName: string;
      employeeNo: string;
      totalDays: number;
      presentDays: number;
      lateDays: number;
      absentDays: number;
      leaveDays: number;
      totalLateMinutes: number;
      totalWorkedMinutes: number;
      totalLunchOverstay: number;
    }>();
    for (const r of rows) {
      let agg = map.get(r.personId);
      if (!agg) {
        agg = {
          personId: r.personId,
          personName: r.person?.name ?? '—',
          employeeNo: r.person?.employeeNo ?? '',
          totalDays: 0,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          leaveDays: 0,
          totalLateMinutes: 0,
          totalWorkedMinutes: 0,
          totalLunchOverstay: 0,
        };
        map.set(r.personId, agg);
      }
      agg.totalDays += 1;
      if (r.status === 'present') agg.presentDays += 1;
      else if (r.status === 'late') agg.lateDays += 1;
      else if (r.status === 'absent') agg.absentDays += 1;
      else if (r.status === 'leave') agg.leaveDays += 1;
      agg.totalLateMinutes += r.lateMinutes;
      agg.totalWorkedMinutes += r.workedMinutes;
      agg.totalLunchOverstay += r.lunchOverstayMinutes;
    }
    return [...map.values()].sort(
      (a, b) => b.totalLateMinutes - a.totalLateMinutes,
    );
  }

  /**
   * Kun bo'yicha statistika (chartlar uchun trend).
   */
  async perDay(opts: {
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

    const rows = await this.repo.find({ where, order: { date: 'ASC' } });
    const map = new Map<
      string,
      {
        date: string;
        total: number;
        present: number;
        late: number;
        absent: number;
        totalLateMinutes: number;
      }
    >();
    for (const r of rows) {
      let day = map.get(r.date);
      if (!day) {
        day = {
          date: r.date,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          totalLateMinutes: 0,
        };
        map.set(r.date, day);
      }
      day.total += 1;
      if (r.status === 'present') day.present += 1;
      else if (r.status === 'late') day.late += 1;
      else if (r.status === 'absent') day.absent += 1;
      day.totalLateMinutes += r.lateMinutes;
    }
    return [...map.values()];
  }
}

// ─── Utility funksiyalari ──────────────────────────────────────────────

/**
 * Maosh xulosasi: baseSalary (oylik) va attendance kunlari asosida.
 *
 * Algoritm:
 *  - Har bir attendance qatori uchun, shu qatorning **OYi**dagi kutilgan ish
 *    kunlari soni hisoblanadi (schedule.workingDays bitmask − bayramlar).
 *  - Bir kunlik tarif = baseSalary / shu oyning ish kunlari.
 *  - Qatorning hissasi = dailyRate × paidDayWeight(status).
 *
 * Bu yondashuv:
 *   ✓ Cross-month oraliqlar to'g'ri hisoblanadi (yanvar+fevral har xil ish kuni)
 *   ✓ Bayramlar maxrajdan olib tashlanadi (haqiqiy kunlik tarif yuqori)
 *   ✓ Yarim oy uchun proportional summa
 *
 * baseSalary <= 0 bo'lsa hammasi 0 — UI "kiritilmagan" indikatori sifatida ko'rsatadi.
 *
 * Schedule yo'q yoki workingDays=0 bo'lsa, oyda STANDARD_WORK_DAYS_PER_MONTH (22)
 * fallback sifatida ishlatiladi.
 */
function computeSalarySummary(
  baseSalaryRaw: string | null,
  rows: AttendanceEntity[],
  totalPenalty: number,
  totalBonus: number,
  schedule: ScheduleEntity | null,
  holidayDates: Set<string>,
): {
  baseMonthly: number;
  dailyRate: number;
  paidDays: number;
  earnedBase: number;
  totalPenalty: number;
  totalBonus: number;
  netPayable: number;
} {
  const baseMonthly = parseFloat(baseSalaryRaw ?? '') || 0;
  if (baseMonthly <= 0) {
    return {
      baseMonthly: 0,
      dailyRate: 0,
      paidDays: 0,
      earnedBase: 0,
      totalPenalty,
      totalBonus,
      netPayable: 0,
    };
  }

  const mask = schedule?.workingDays ?? 0;
  // Per-(year,month) cache — bir oydagi ish kunlari faqat bir marta hisoblansin.
  const monthCache = new Map<string, number>();
  const monthDays = (year: number, month: number): number => {
    const k = `${year}-${month}`;
    let v = monthCache.get(k);
    if (v === undefined) {
      v = workingDaysInMonth(year, month, mask, holidayDates);
      monthCache.set(k, v);
    }
    return v;
  };

  let earnedBase = 0;
  let paidDays = 0;
  let weightedRateSum = 0; // dailyRate'ning paidDays-bo'yicha o'rtachasi (UI uchun)
  for (const row of rows) {
    const weight = paidDayWeight(row.status);
    if (weight === 0) continue;
    const [ys, ms] = row.date.split('-');
    const days = monthDays(parseInt(ys, 10), parseInt(ms, 10) - 1);
    const dailyRate = baseMonthly / days;
    earnedBase += dailyRate * weight;
    paidDays += weight;
    weightedRateSum += dailyRate * weight;
  }
  const avgDailyRate =
    paidDays > 0 ? weightedRateSum / paidDays : baseMonthly / STANDARD_WORK_DAYS_PER_MONTH;
  const netPayable = earnedBase + totalBonus - totalPenalty;

  return {
    baseMonthly: round2(baseMonthly),
    dailyRate: round2(avgDailyRate),
    paidDays: round2(paidDays),
    earnedBase: round2(earnedBase),
    totalPenalty: round2(totalPenalty),
    totalBonus: round2(totalBonus),
    netPayable: round2(netPayable),
  };
}

interface DirectedEvent {
  capturedAt: Date | string;
  direction: 'in' | 'out';
}

interface PairedInterval {
  in: Date;
  out: Date;
  /** Hali yopilmagan (hodim ichkarida, kun bugun) — `out` joriy vaqt sifatida o'rnatilgan */
  isOpen?: boolean;
  /** Avtomatik yopilgan (kun o'tgan, oxirgi 'in' ga 'out' kelmagan) — `out` workEnd ga teng */
  isAutoClosed?: boolean;
}

/**
 * Eventlarni in→out juftliklariga ajratadi.
 * Yopilmagan oxirgi `in` uchun:
 *  - bugun va vaqt hali tugamagan bo'lsa — `now` bilan yopiladi (currentlyInside=true)
 *  - kun o'tgan bo'lsa — `autoCloseAt` (odatda workEnd) bilan yopiladi
 */
function pairIntoIntervals(
  events: DirectedEvent[],
  opts: {
    isToday: boolean;
    isPast: boolean;
    now: Date;
    autoCloseAt: Date;
  },
): { intervals: PairedInterval[]; currentlyInside: boolean } {
  const intervals: PairedInterval[] = [];
  let currentIn: Date | null = null;

  for (const e of events) {
    const t = e.capturedAt instanceof Date ? e.capturedAt : new Date(e.capturedAt);
    if (e.direction === 'in') {
      if (currentIn === null) {
        currentIn = t;
      } else {
        // Ketma-ket ikki 'in' — anomaliya. Birinchisini saqlab, ikkinchisini e'tiborsiz qoldiramiz.
      }
    } else if (currentIn !== null) {
      intervals.push({ in: currentIn, out: t });
      currentIn = null;
    }
  }

  let currentlyInside = false;
  if (currentIn !== null) {
    if (opts.isToday) {
      // Bugun, hodim hali ichkarida — joriy vaqtgacha hisoblaymiz, lekin lastOut yo'q
      intervals.push({ in: currentIn, out: opts.now, isOpen: true });
      currentlyInside = true;
    } else if (opts.isPast) {
      // O'tgan kun, oxirgi 'in' yopilmagan — workEnd da auto-yopamiz
      const closeAt =
        opts.autoCloseAt > currentIn ? opts.autoCloseAt : currentIn;
      intervals.push({ in: currentIn, out: closeAt, isAutoClosed: true });
    }
  }

  return { intervals, currentlyInside };
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
