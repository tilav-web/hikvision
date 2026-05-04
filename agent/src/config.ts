import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * .env faylni 2 joyda izlaymiz, prioritet bo'yicha:
 *   1. Joriy ishchi papka (process.cwd()) — buyruq satridan ishga tushirganda
 *   2. Binary'ning o'z papkasi (process.execPath) — Explorer'dan yoki absolyut yo'l bilan
 *      ishga tushirilganda. pkg bilan compile qilingan .exe uchun shu yetarli.
 */
const candidateDirs = [
  process.cwd(),
  path.dirname(process.execPath),
];

const seen = new Set<string>();
for (const dir of candidateDirs) {
  if (!dir || seen.has(dir)) continue;
  seen.add(dir);
  const envLocal = path.join(dir, '.env.local');
  const envFile = path.join(dir, '.env');
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal, override: false });
  }
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(
      `.env: '${key}' shart. ` +
        `.env fayl quyidagi papkalarning birida bo'lishi kerak: ${[...seen].join(', ')}`,
    );
  }
  return v;
}

export const config = {
  serverUrl: required('SERVER_URL'),
  agentToken: required('AGENT_TOKEN'),
  logLevel: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
  reconnectDelayMs: Number.parseInt(process.env.RECONNECT_DELAY_MS ?? '5000', 10),
  cmdTimeoutMs: Number.parseInt(process.env.CMD_TIMEOUT_MS ?? '60000', 10),
};

export type AgentConfig = typeof config;
