import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { DeviceEntity } from '../entities/device.entity';
import { decryptSecret } from '../../common/crypto.util';

interface PendingCommand {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface AgentCommand {
  id: string;
  action: string;
  payload: any;
}

export interface AgentResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Mijoz tomonidagi agent shu gateway'ga ulanadi.
 * Server u orqali mahalliy aparatga `addUser`, `uploadFace` va h.k. komandalarini yuboradi.
 */
@WebSocketGateway({
  namespace: '/agents',
  cors: { origin: '*', credentials: true },
})
export class AgentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentsGateway.name);

  @WebSocketServer()
  server!: Server;

  // deviceId → socket
  private readonly sockets = new Map<string, Socket>();
  // commandId → resolver
  private readonly pending = new Map<string, PendingCommand>();

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = (client.handshake.auth ?? {}) as { token?: string; deviceId?: string };
    const { token, deviceId } = auth;

    if (!token || !deviceId) {
      this.logger.warn(`agent rad etildi: token yoki deviceId yo'q`);
      client.disconnect(true);
      return;
    }

    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device || !device.agentToken || device.agentToken !== token) {
      this.logger.warn(`agent rad etildi: noto'g'ri token (deviceId=${deviceId})`);
      client.disconnect(true);
      return;
    }

    // Eski ulanish bo'lsa, almashtiramiz
    const old = this.sockets.get(deviceId);
    if (old && old.id !== client.id) {
      old.disconnect(true);
    }
    this.sockets.set(deviceId, client);
    (client.data as any).deviceId = deviceId;

    await this.deviceRepo.update(deviceId, {
      agentOnline: true,
      agentLastSeenAt: new Date(),
    });

    this.logger.log(`✅ agent ulandi: deviceId=${deviceId}, sockId=${client.id}`);
    // Agent kerakli aparat ma'lumotlarini server'dan oladi (parolni .env'ga yozmasin)
    client.emit('agent:welcome', {
      deviceId,
      device: {
        host: device.host,
        port: device.port,
        useHttps: device.useHttps,
        username: device.username,
        password: decryptSecret(device.passwordEnc),
      },
    });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const deviceId = (client.data as any)?.deviceId as string | undefined;
    if (!deviceId) return;
    const cur = this.sockets.get(deviceId);
    if (cur === client) {
      this.sockets.delete(deviceId);
      await this.deviceRepo.update(deviceId, {
        agentOnline: false,
        agentLastSeenAt: new Date(),
      });
      this.logger.warn(`❌ agent uzildi: deviceId=${deviceId}`);
    }
  }

  isOnline(deviceId: string): boolean {
    return this.sockets.has(deviceId);
  }

  async sendCommand<T = any>(
    deviceId: string,
    action: string,
    payload: any,
    timeoutMs = 60_000,
  ): Promise<T> {
    const sock = this.sockets.get(deviceId);
    if (!sock) {
      throw new Error(`agent ${deviceId} ulanmagan`);
    }
    const id = crypto.randomUUID();
    const cmd: AgentCommand = { id, action, payload };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`agent timeout: ${action} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      sock.emit('agent:cmd', cmd);
    });
  }

  @SubscribeMessage('agent:cmd:result')
  onResult(
    @ConnectedSocket() client: Socket,
    @MessageBody() result: AgentResult,
  ): void {
    if (!result || !result.id) return;
    const p = this.pending.get(result.id);
    if (!p) return;
    clearTimeout(p.timeout);
    this.pending.delete(result.id);
    if (result.success) {
      p.resolve(result.data);
    } else {
      p.reject(new Error(result.error ?? 'agent error'));
    }
  }
}
