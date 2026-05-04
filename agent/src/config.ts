import * as dotenv from 'dotenv';
import * as path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`.env: '${key}' shart`);
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
