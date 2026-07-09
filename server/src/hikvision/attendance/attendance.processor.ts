import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { AttendanceService } from './attendance.service';

export const ATTENDANCE_QUEUE = 'attendance';
export const FINALIZE_DAY_JOB = 'finalize-day';

/** TZ'dagi kechagi sana (YYYY-MM-DD). */
function yesterdayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '01';
  const todayStr = `${g('year')}-${g('month')}-${g('day')}`;
  const d = new Date(todayStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * BullMQ worker — kunlik davomatni yakunlaydigan fon-vazifa.
 *
 * Repeatable job har kuni 00:30 (TZ_DEFAULT) da ishga tushib, kechagi kun
 * uchun `finalizeDay` chaqiradi: kelmagan hodimlarga "absent" yozadi va ochiq
 * kunlarni yopadi. Manual/backfill uchun ham shu queue'ga job qo'shiladi.
 *
 * Cron o'rniga BullMQ ishlatilgan sabab: Redis'da persistent, retry bor va
 * ko'p-instansli deploy'da faqat bitta worker bajaradi (cron takrorlanmaydi).
 */
@Processor(ATTENDANCE_QUEUE)
export class AttendanceProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AttendanceProcessor.name);

  constructor(
    @InjectQueue(ATTENDANCE_QUEUE) private readonly queue: Queue,
    private readonly attendance: AttendanceService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const tz = process.env.TZ_DEFAULT || 'Asia/Tashkent';
    // Repeatable job — BullMQ (name, pattern, tz) bo'yicha deduplikatsiya qiladi,
    // shuning uchun har restart'da qayta qo'shsak ham dublikat bo'lmaydi.
    await this.queue.add(
      FINALIZE_DAY_JOB,
      {},
      {
        repeat: { pattern: '30 0 * * *', tz },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    this.logger.log(`davomat finalize-day cron o'rnatildi (30 0 * * *, ${tz})`);
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === FINALIZE_DAY_JOB) {
      const tz = process.env.TZ_DEFAULT || 'Asia/Tashkent';
      const date = (job.data?.date as string) || yesterdayInTz(tz);
      const companyId = job.data?.companyId as string | undefined;
      return this.attendance.finalizeDay(date, companyId);
    }
    this.logger.warn(`noma'lum job: ${job.name}`);
    return null;
  }
}
