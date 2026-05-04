import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`.env: '${key}' shart`);
  return v;
}

export const config = {
  serverUrl: required('SERVER_URL'),
  agentToken: required('AGENT_TOKEN'),
  deviceId: required('DEVICE_ID'),
  // Aparat ma'lumotlari server tomonidan beriladi (welcome event'da).
  // Agar serverdan olishni xohlamasangiz, .env'ga DEVICE_HOST yozsangiz, prioritetda.
  device: process.env.DEVICE_HOST
    ? {
        host: process.env.DEVICE_HOST,
        port: Number.parseInt(process.env.DEVICE_PORT ?? '443', 10),
        useHttps: (process.env.DEVICE_USE_HTTPS ?? 'true').toLowerCase() === 'true',
        username: process.env.DEVICE_USERNAME ?? 'admin',
        password: process.env.DEVICE_PASSWORD ?? '',
      }
    : null,
  logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  reconnectDelayMs: Number.parseInt(process.env.RECONNECT_DELAY_MS ?? '5000', 10),
};

export type AgentConfig = typeof config;
