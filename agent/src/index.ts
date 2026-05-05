#!/usr/bin/env node
import { config } from './config';
import { logger, setLevel } from './logger';
import { DevicePool } from './device-pool';
import { CommandHandler } from './commands';
import { ServerLink } from './server-link';
import { SadpDiscovery } from './sadp';

async function main(): Promise<void> {
  setLevel(config.logLevel);

  logger.info('───────────────────────────────────────────────');
  logger.info(`Hikvision Agent boshlanmoqda`);
  logger.info(`  server : ${config.serverUrl}`);
  logger.info(`  agent  : ${config.agentName}`);
  logger.info(`  qurilma ro'yxati serverdan welcome'da olinadi`);
  logger.info('───────────────────────────────────────────────');

  const pool = new DevicePool();
  const sadp = new SadpDiscovery();
  sadp.start();
  const handler = new CommandHandler(pool, sadp);
  const link = new ServerLink(config, pool, handler);
  link.start();

  const shutdown = (signal: string) => {
    logger.info(`🛑 ${signal} qabul qilindi, agent to'xtaydi`);
    link.stop();
    sadp.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error('agent ishga tushmadi:', (e as Error).message);
  process.exit(1);
});
