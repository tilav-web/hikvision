import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnection } from '../config/redis.config';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

// Token alohida faylda (redis.constants) — circular import bo'lmasin.
// Backward-compat: mavjud importlar redis.module'dan olishda davom etadi.
export { REDIS_CLIENT } from './redis.constants';

/**
 * Umumiy ioredis client. BullMQ'nikidan farqli — bu tez-fail:
 * Redis o'chiq bo'lsa buyruq abadiy kutmaydi (health/blocklist bloklanmasin).
 */
const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => {
    const client = new Redis({
      ...redisConnection(cfg),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      commandTimeout: 2000,
      lazyConnect: false,
    });
    // 'error' listener bo'lmasa ioredis xato tashlashi mumkin — jim yutamiz
    // (ulanish qayta tiklanadi; health/log alohida ko'rsatadi).
    client.on('error', () => undefined);
    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider, CacheService],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
