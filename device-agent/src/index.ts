#!/usr/bin/env node
import { config } from './config';
import { logger, setLevel } from './logger';
import { IsapiClient } from './isapi/isapi-client';
import { CommandHandler } from './commands';
import { ServerLink } from './server-link';

async function main(): Promise<void> {
  setLevel(config.logLevel);

  logger.info('───────────────────────────────────────────────');
  logger.info(`Hikvision Device Agent boshlanmoqda`);
  logger.info(`  server   : ${config.serverUrl}`);
  logger.info(`  deviceId : ${config.deviceId}`);
  if (config.device) {
    logger.info(`  device   : ${config.device.host}:${config.device.port} (.env'dan)`);
  } else {
    logger.info(`  device   : (server welcome'dan kutilyapti)`);
  }
  logger.info('───────────────────────────────────────────────');

  // .env'da yozilgan bo'lsa darhol IsapiClient yaratamiz, aks holda welcome'gacha kutamiz
  let initialClient: IsapiClient | null = null;
  if (config.device) {
    initialClient = new IsapiClient(config.device);
    const ok = await initialClient.ping();
    logger.info(ok ? '🔌 aparat erishilarli' : '⚠️  aparat hozir erishilmas');
  }

  const handler = new CommandHandler(initialClient);
  const link = new ServerLink(config, handler, (creds) => {
    handler.setClient(new IsapiClient(creds));
  });
  link.start();

  const shutdown = (signal: string) => {
    logger.info(`🛑 ${signal} qabul qilindi, agent to'xtaydi`);
    link.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((e) => {
  logger.error('agent ishga tushmadi:', (e as Error).message);
  process.exit(1);
});
