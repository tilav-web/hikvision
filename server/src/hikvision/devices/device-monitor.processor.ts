import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { DevicesService } from './devices.service';

export const DEVICE_MONITOR_QUEUE = 'device-monitor';
export const SWEEP_OFFLINE_JOB = 'sweep-offline';

/**
 * Qurilma holati monitori — heartbeat/event to'xtagan qurilmalarni offline
 * deb belgilaydi. BullMQ repeatable job har 2 daqiqada ishlaydi.
 *
 * Ilgari qurilma bir marta online bo'lgach, heartbeat to'xtasa ham abadiy
 * "online" ko'rinardi. Endi eskirganlar avtomatik offline bo'ladi.
 */
@Processor(DEVICE_MONITOR_QUEUE)
export class DeviceMonitorProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(DeviceMonitorProcessor.name);

  constructor(
    @InjectQueue(DEVICE_MONITOR_QUEUE) private readonly queue: Queue,
    private readonly devices: DevicesService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_OFFLINE_JOB,
      {},
      {
        repeat: { pattern: '*/2 * * * *' }, // har 2 daqiqada
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );
    this.logger.log('qurilma offline-sweep cron o\'rnatildi (har 2 daqiqada)');
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === SWEEP_OFFLINE_JOB) {
      const offline = await this.devices.sweepOffline();
      return { offline };
    }
    return null;
  }
}
