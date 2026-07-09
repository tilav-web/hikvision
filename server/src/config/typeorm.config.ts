import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DeviceEntity } from '../hikvision/entities/device.entity';
import { PersonEntity } from '../hikvision/entities/person.entity';
import { PersonDeviceEntity } from '../hikvision/entities/person-device.entity';
import { AccessEventEntity } from '../hikvision/entities/access-event.entity';
import { AgentEntity } from '../hikvision/entities/agent.entity';
import { ScheduleEntity } from '../hikvision/entities/schedule.entity';
import { AttendanceEntity } from '../hikvision/entities/attendance.entity';
import { PenaltyEntity } from '../hikvision/entities/penalty.entity';
import { HolidayEntity } from '../hikvision/entities/holiday.entity';
import { VacationEntity } from '../hikvision/entities/vacation.entity';
import { CompanyEntity } from '../companies/company.entity';
import { UserEntity } from '../users/user.entity';
import { TelegramChannelEntity } from '../telegram/entities/telegram-channel.entity';

export const allEntities = [
  CompanyEntity,
  UserEntity,
  AgentEntity,
  DeviceEntity,
  PersonEntity,
  PersonDeviceEntity,
  AccessEventEntity,
  ScheduleEntity,
  AttendanceEntity,
  PenaltyEntity,
  HolidayEntity,
  VacationEntity,
  TelegramChannelEntity,
];

export const typeOrmAsyncConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    type: 'postgres',
    host: cfg.get<string>('DB_HOST', 'localhost'),
    port: parseInt(cfg.get<string>('DB_PORT', '5432'), 10),
    username: cfg.get<string>('DB_USER', 'postgres'),
    password: cfg.get<string>('DB_PASSWORD', 'postgres'),
    database: cfg.get<string>('DB_NAME', 'hikvision'),
    entities: allEntities,
    // MUHIM: production'da synchronize HECH QACHON yoqilmaydi (DB_SYNC=true
    // bo'lsa ham) — bu sxemani boot'da ALTER qilib ma'lumot yo'qotishi mumkin.
    // Prod'da migratsiyalardan foydalaning: `npm run migration:run`.
    synchronize:
      cfg.get<string>('NODE_ENV') !== 'production' &&
      cfg.get<string>('DB_SYNC', 'false') === 'true',
    migrations: ['dist/migrations/*.js'],
    migrationsTableName: 'migrations',
    logging: cfg.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    autoLoadEntities: true,
  }),
};
