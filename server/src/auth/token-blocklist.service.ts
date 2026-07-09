import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * JWT bekor qilish (revocation) — logout'da token'ning `jti`si Redis'ga
 * qo'shiladi va tabiiy amal muddati tugagunча blocklist'da qoladi. Har so'rovda
 * JwtStrategy shu ro'yxatni tekshiradi → bekor qilingan token darhol ishlamaydi.
 *
 * Redis o'chiq bo'lsa fail-open (uptime muhimroq) — lekin log qilinadi.
 */
@Injectable()
export class TokenBlocklistService {
  private readonly logger = new Logger(TokenBlocklistService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(jti: string): string {
    return `bl:jwt:${jti}`;
  }

  /** Token'ni bekor qilish. `expUnix` — token exp (soniyada), TTL shunga qarab. */
  async revoke(jti: string, expUnix: number): Promise<void> {
    const ttl = Math.max(1, expUnix - Math.floor(Date.now() / 1000));
    try {
      await this.redis.set(this.key(jti), '1', 'EX', ttl);
    } catch (e) {
      this.logger.warn(`token revoke xato: ${(e as Error).message}`);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    try {
      return (await this.redis.exists(this.key(jti))) === 1;
    } catch (e) {
      this.logger.warn(
        `blocklist tekshirish xato (fail-open): ${(e as Error).message}`,
      );
      return false;
    }
  }
}
