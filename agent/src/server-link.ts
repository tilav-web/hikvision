import { io, Socket } from 'socket.io-client';
import { CommandEnvelope, CommandHandler, CommandResult } from './commands';
import { AgentConfig } from './config';
import { DevicePool, ManagedDevice } from './device-pool';
import { logger } from './logger';

interface WelcomePayload {
  agentId: string;
  devices: ManagedDevice[];
}

export class ServerLink {
  private socket: Socket | null = null;
  private connected = false;

  constructor(
    private readonly cfg: AgentConfig,
    private readonly pool: DevicePool,
    private readonly handler: CommandHandler,
  ) {}

  start(): void {
    const url = this.cfg.serverUrl.replace(/\/+$/, '');
    if (this.cfg.tlsInsecure) {
      logger.warn(
        '⚠️  INSECURE_TLS=true — server sertifikati tekshirilmayapti. Bu faqat dev uchun!',
      );
    }
    this.socket = io(`${url}/agents`, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: this.cfg.reconnectDelayMs,
      reconnectionDelayMax: 30_000,
      auth: {
        token: this.cfg.companyToken,
        name: this.cfg.agentName,
      },
      rejectUnauthorized: !this.cfg.tlsInsecure,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      logger.info(`✅ serverga ulandi (${url})`);
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      logger.warn(`❌ serverdan uzildi: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      logger.error(`ulanish xatosi: ${err.message}`);
    });

    this.socket.on('agent:welcome', (data: WelcomePayload) => {
      logger.info(
        `🎉 ro'yxatdan o'tdi: agentId=${data.agentId}, devices=${data.devices?.length ?? 0}`,
      );
      this.pool.upsert(data.devices ?? []);
    });

    this.socket.on('agent:devices:update', (data: { devices: ManagedDevice[] }) => {
      logger.info(`🔄 qurilmalar ro'yxati yangilandi: ${data.devices.length}`);
      this.pool.upsert(data.devices);
    });

    this.socket.on(
      'agent:cmd',
      async (cmd: CommandEnvelope, ack?: (r: CommandResult) => void) => {
        const result = await this.handler.execute(cmd);
        if (typeof ack === 'function') {
          try {
            ack(result);
          } catch {}
        }
        this.socket?.emit('agent:cmd:result', result);
      },
    );
  }

  forwardEvent(deviceId: string, event: Record<string, any>): void {
    this.socket?.emit('agent:event', { deviceId, event });
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
