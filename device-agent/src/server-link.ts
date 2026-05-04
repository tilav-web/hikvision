import { io, Socket } from 'socket.io-client';
import { CommandEnvelope, CommandHandler, CommandResult } from './commands';
import { AgentConfig } from './config';
import { DeviceCredentials } from './isapi/types';
import { IsapiClient } from './isapi/isapi-client';
import { logger } from './logger';

export class ServerLink {
  private socket: Socket | null = null;
  private connected = false;

  constructor(
    private readonly cfg: AgentConfig,
    private readonly handler: CommandHandler,
    private readonly onCredentials: (creds: DeviceCredentials) => void,
  ) {}

  start(): void {
    const url = this.cfg.serverUrl.replace(/\/+$/, '');
    this.socket = io(`${url}/agents`, {
      // pkg-bundled binarda 'ws' modulini boot qilish muammoli — polling'ga ham
      // ruxsat berib, websocket'ga upgrade'ni socket.io o'zi qiladi
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: this.cfg.reconnectDelayMs,
      reconnectionDelayMax: 30_000,
      auth: {
        token: this.cfg.agentToken,
        deviceId: this.cfg.deviceId,
      },
      rejectUnauthorized: false,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      logger.info(`✅ serverga ulandi (${url}), deviceId=${this.cfg.deviceId}`);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      logger.warn(`❌ serverdan uzildi: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      logger.error(`ulanish xatosi: ${err.message}`);
    });

    this.socket.on(
      'agent:welcome',
      (data: { deviceId: string; device?: DeviceCredentials }) => {
        logger.info(`🎉 ro'yxatdan o'tdi: deviceId=${data.deviceId}`);
        if (data.device) {
          this.onCredentials(data.device);
          logger.info(
            `🔑 aparat ma'lumotlari serverdan olindi: ${data.device.host}:${data.device.port}`,
          );
        }
      },
    );

    this.socket.on('agent:cmd', async (cmd: CommandEnvelope, ack?: (r: CommandResult) => void) => {
      const result = await this.handler.execute(cmd);
      // Ikki kanaldan ham qaytaramiz: ack (agar callback berilgan) + alohida event (durable)
      if (typeof ack === 'function') {
        try {
          ack(result);
        } catch {}
      }
      this.socket?.emit('agent:cmd:result', result);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  stop(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}
