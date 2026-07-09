import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Umumiy Redis connection opsiyalari — BullMQ, throttler storage va
 * socket.io adapter shu yerdan oladi.
 *
 * `maxRetriesPerRequest: null` — BullMQ majburiy talabi (blocking komandalar
 * uchun). Boshqa mijozlarga ham zarar qilmaydi.
 */
export function redisConnection(cfg: ConfigService): RedisOptions {
  return {
    host: cfg.get<string>('REDIS_HOST', 'localhost'),
    port: parseInt(cfg.get<string>('REDIS_PORT', '6379'), 10),
    maxRetriesPerRequest: null,
  };
}
