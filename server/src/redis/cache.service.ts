import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Oddiy Redis cache — og'ir agregat so'rovlar (stats/dashboard) uchun.
 * fail-open: Redis o'chiq bo'lsa producer to'g'ridan chaqiriladi (bloklanmaydi).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async getOrSet<T>(
    key: string,
    ttlSec: number,
    producer: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached != null) return JSON.parse(cached) as T;
    } catch (e) {
      this.logger.debug(`cache get xato (fall-through): ${(e as Error).message}`);
    }
    const value = await producer();
    try {
      await this.redis.set(
        key,
        JSON.stringify(value),
        'EX',
        Math.max(1, ttlSec),
      );
    } catch (e) {
      this.logger.debug(`cache set xato: ${(e as Error).message}`);
    }
    return value;
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      /* ignore */
    }
  }
}
