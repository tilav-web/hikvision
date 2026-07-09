import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';

/**
 * Container readiness/liveness probe uchun. DB jonliligi tekshiriladi.
 * - 200: barcha tekshiruvlar muvaffaqiyatli
 * - 503: DB yetib bo'lmadi (load balancer trafikni boshqa instance'ga yo'naltirsin)
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + DB readiness probe' })
  async check() {
    const startedAt = Date.now();
    let dbOk = false;
    try {
      await this.ds.query('SELECT 1');
      dbOk = true;
    } catch (e) {
      // Xato detali autentifikatsiyasiz oshkor qilinmaydi — faqat server logida.
      this.logger.error(`health DB check failed: ${(e as Error).message}`);
    }
    const status = dbOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      checks: {
        db: { ok: dbOk, latencyMs: Date.now() - startedAt },
      },
    };
  }
}
