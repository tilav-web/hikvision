import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DeviceEntity } from '../hikvision/entities/device.entity';
import { PersonEntity } from '../hikvision/entities/person.entity';
import { PersonDeviceEntity } from '../hikvision/entities/person-device.entity';
import { AccessEventEntity } from '../hikvision/entities/access-event.entity';

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
    entities: [DeviceEntity, PersonEntity, PersonDeviceEntity, AccessEventEntity],
    synchronize: cfg.get<string>('DB_SYNC', 'true') === 'true',
    logging: cfg.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
    autoLoadEntities: true,
  }),
};
