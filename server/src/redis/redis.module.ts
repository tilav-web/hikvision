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

/** Umumiy Redis client injection tokeni (blocklist, cache, health va h.k.). */
export const REDIS_CLIENT = 'REDIS_CLIENT';

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
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
