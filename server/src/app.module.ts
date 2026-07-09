import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { join } from 'path';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { redisConnection } from './config/redis.config';
import { RedisModule } from './redis/redis.module';
import { HikvisionModule } from './hikvision/hikvision.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';
import { HealthController } from './health/health.controller';
import { TelegramModule } from './telegram/telegram.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync(typeOrmAsyncConfig),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false },
    }),
    // BullMQ — fon-vazifalar (absent-cron, kelajakda sync/import/hisobot).
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: redisConnection(cfg),
      }),
    }),
    // Default — global rate limit. Login uchun stricter alohida belgilanadi.
    // Storage Redis'da — restart'da nollanmaydi va bir necha instansda umumiy.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        throttlers: [
          { name: 'short', ttl: 1_000, limit: 20 },
          { name: 'medium', ttl: 60_000, limit: 200 },
        ],
        storage: new ThrottlerStorageRedisService(new Redis(redisConnection(cfg))),
      }),
    }),
    RedisModule,
    AuditModule,
    UsersModule,
    AuthModule,
    CompaniesModule,
    TelegramModule,
    HikvisionModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly users: UsersService,
    private readonly cfg: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.cfg.get<string>('SUPER_ADMIN_EMAIL');
    const password = this.cfg.get<string>('SUPER_ADMIN_PASSWORD');
    const fullName = this.cfg.get<string>('SUPER_ADMIN_NAME', 'Super Admin');
    if (email && password) {
      await this.users.ensureSuperAdmin(email, password, fullName);
    }
  }
}
