import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { typeOrmAsyncConfig } from './config/typeorm.config';
import { HikvisionModule } from './hikvision/hikvision.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { UsersService } from './users/users.service';

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
    UsersModule,
    AuthModule,
    CompaniesModule,
    HikvisionModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
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
