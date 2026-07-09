import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';
import { redisConnection } from '../config/redis.config';

/**
 * Socket.IO Redis adapter — WebSocket event'larini bir necha server instansi
 * o'rtasida tarqatadi. Buning yordamida backend gorizontal masshtablanadi
 * (nginx/LB ortida N ta instans), har bir brauzer/agent istalgan instansga
 * ulanib, event'lar Redis pub/sub orqali barcha instanslarga yetadi.
 *
 * Redis vaqtincha o'chiq bo'lsa ham app ishga tushadi — ioredis o'zi qayta
 * ulanadi; bitta instans rejimida local adapter baribir ishlaydi.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private readonly appCtx: INestApplicationContext) {
    super(appCtx);
  }

  async connectToRedis(): Promise<void> {
    const cfg = this.appCtx.get(ConfigService);
    const pubClient = new Redis(redisConnection(cfg));
    const subClient = pubClient.duplicate();
    let warned = false;
    const onErr = (e: Error) => {
      if (!warned) {
        this.logger.warn(`Redis adapter ulanish xatosi: ${e.message}`);
        warned = true; // spam qilmaslik uchun faqat birinchi xato
      }
    };
    pubClient.on('error', onErr);
    subClient.on('error', onErr);
    pubClient.on('ready', () => {
      warned = false;
      this.logger.log('Socket.IO Redis adapter tayyor');
    });
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
