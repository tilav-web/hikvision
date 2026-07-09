import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SkipThrottle } from '@nestjs/throttler';
import Redis from 'ioredis';
import { Public } from '../auth/public.decorator';
import { REDIS_CLIENT } from '../redis/redis.module';

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
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + DB/Redis readiness probe' })
  async check() {
    const dbStart = Date.now();
    let dbOk = false;
    try {
      await this.ds.query('SELECT 1');
      dbOk = true;
    } catch (e) {
      // Xato detali autentifikatsiyasiz oshkor qilinmaydi — faqat server logida.
      this.logger.error(`health DB check failed: ${(e as Error).message}`);
    }
    const dbLatency = Date.now() - dbStart;

    const redisStart = Date.now();
    let redisOk = false;
    try {
      redisOk = (await this.redis.ping()) === 'PONG';
    } catch (e) {
      this.logger.error(`health Redis check failed: ${(e as Error).message}`);
    }
    const redisLatency = Date.now() - redisStart;

    const status = dbOk && redisOk ? 'ok' : 'degraded';
    return {
      status,
      timestamp: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      checks: {
        db: { ok: dbOk, latencyMs: dbLatency },
        redis: { ok: redisOk, latencyMs: redisLatency },
      },
    };
  }
}
