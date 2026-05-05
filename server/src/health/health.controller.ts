import { Controller, Get } from '@nestjs/common';
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
    let dbError: string | null = null;
    try {
      await this.ds.query('SELECT 1');
      dbOk = true;
    } catch (e) {
      dbError = (e as Error).message;
    }
    const status = dbOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      checks: {
        db: { ok: dbOk, error: dbError, latencyMs: Date.now() - startedAt },
      },
    };
  }
}
