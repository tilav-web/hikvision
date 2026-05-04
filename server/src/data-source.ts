import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { allEntities } from './config/typeorm.config';

config({ path: '.env.local', override: false });
config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'hikvision',
  entities: allEntities,
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'warn'],
});

export default AppDataSource;
