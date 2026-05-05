import { forwardRef, Inject, Logger } from '@nestjs/common';
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
import { AgentEntity } from '../entities/agent.entity';
import { DeviceEntity } from '../entities/device.entity';
import { decryptSecret } from '../../common/crypto.util';
import { CompaniesService } from '../../companies/companies.service';
import { AgentsService } from './agents.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../../telegram/notifications.service';

interface PendingCommand {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface AgentCommand {
  id: string;
  deviceId: string;
  action: string;
  payload: any;
}

export interface AgentResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface AgentDevicePayload {
  id: string;
  name: string;
  mode: 'entry' | 'exit' | 'both';
  credentials: {
    host: string;
    port: number;
    useHttps: boolean;
    username: string;
    password: string;
  };
}

/**
 * Agent gateway. Auth: kampaniya `apiToken` + agent `name` (har kampaniya ichida unikal).
 * Telegram bot uslubi: 1 kampaniya = 1 token, mijoz istalgan agentlarni shu token bilan ulaydi.
 *
 * Mijoz `.env`:
 *   COMPANY_TOKEN=<Companies sahifasidan>
 *   AGENT_NAME=Bosh ofis - RPI4
 */
@WebSocketGateway({
  namespace: '/agents',
  cors: { origin: '*', credentials: true },
})
export class AgentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentsGateway.name);

  @WebSocketServer()
  server!: Server;

  // agentId → socket
  private readonly sockets = new Map<string, Socket>();
  // commandId → resolver
  private readonly pending = new Map<string, PendingCommand>();

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    private readonly companies: CompaniesService,
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = (client.handshake.auth ?? {}) as {
      token?: string;
      name?: string;
    };
    const token = auth.token;
    const name = auth.name?.trim();

    if (!token || !name) {
      this.logger.warn(`agent rad etildi: token yoki name yo'q`);
      client.disconnect(true);
      return;
    }

    const company = await this.companies.findByApiToken(token);
    if (!company) {
      this.logger.warn(`agent rad etildi: noto'g'ri token`);
      client.disconnect(true);
      return;
    }
    if (company.status !== 'active') {
      this.logger.warn(
        `agent rad etildi: kampaniya ${company.slug} faol emas`,
      );
      client.disconnect(true);
      return;
    }

    const agent = await this.agentsService.findOrCreateForConnect(
      company.id,
      name,
    );

    const old = this.sockets.get(agent.id);
    if (old && old.id !== client.id) {
      old.disconnect(true);
    }
    this.sockets.set(agent.id, client);
    (client.data as any).agentId = agent.id;
    (client.data as any).companyId = company.id;

    await this.agentRepo.update(agent.id, {
      isOnline: true,
      lastSeenAt: new Date(),
    });

    const devices = await this.loadDevices(agent.id);
    this.logger.log(
      `✅ agent ulandi: ${name} (${company.slug}), devices=${devices.length}`,
    );

    client.emit('agent:welcome', {
      agentId: agent.id,
      devices,
    });
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const agentId = (client.data as any)?.agentId as string | undefined;
    if (!agentId) return;
    const cur = this.sockets.get(agentId);
    if (cur === client) {
      this.sockets.delete(agentId);
      const now = new Date();
      await this.agentRepo.update(agentId, {
        isOnline: false,
        lastSeenAt: now,
      });
      this.logger.warn(`❌ agent uzildi: agentId=${agentId}`);

      // Telegram bildirishnoma — agent qaysi kampaniyaga tegishli ekanini topib yuboramiz
      const agent = await this.agentRepo.findOne({ where: { id: agentId } });
      if (agent) {
        void this.notifications.dispatch('agent_offline', agent.companyId, {
          agentName: agent.name,
          lastSeenAt: now,
        });
      }
    }
  }

  isAgentOnline(agentId: string): boolean {
    const sock = this.sockets.get(agentId);
    // Faqat map'da emas, socket haqiqatdan ham connected bo'lishi shart —
    // crash holatlarida stale entry qoladi, false-positive "online" beradi.
    return !!sock && sock.connected;
  }

  /**
   * Server qurilmaga buyruq yuboradi: bu yerda biz qurilmaga tegishli
   * agentni topib, uning socketi orqali yuboramiz.
   */
  async sendCommand<T = any>(
    deviceId: string,
    action: string,
    payload: any,
    timeoutMs = 60_000,
  ): Promise<T> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new Error(`device ${deviceId} topilmadi`);
    if (!device.agentId)
      throw new Error(`device ${deviceId} hech bir agentga bog'lanmagan`);

    const sock = this.sockets.get(device.agentId);
    if (!sock) throw new Error(`agent ${device.agentId} ulanmagan`);

    const id = crypto.randomUUID();
    const cmd: AgentCommand = { id, deviceId, action, payload };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`agent timeout: ${action} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      sock.emit('agent:cmd', cmd);
    });
  }

  /**
   * Agentning o'ziga buyruq yuborish (deviceId talab qilinmaydi).
   * Masalan 'inspect' kabi agent darajasidagi buyruqlar uchun.
   */
  async sendAgentCommand<T = any>(
    agentId: string,
    action: string,
    payload: any = {},
    timeoutMs = 30_000,
  ): Promise<T> {
    const sock = this.sockets.get(agentId);
    if (!sock) throw new Error(`agent ${agentId} ulanmagan`);

    const id = crypto.randomUUID();
    const cmd: AgentCommand = { id, deviceId: '', action, payload };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`agent timeout: ${action} (${timeoutMs}ms)`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      sock.emit('agent:cmd', cmd);
    });
  }

  /**
   * Agentga uning qurilma ro'yxati o'zgarganini xabar qilish
   * (CRUD bilan device yangilanganda chaqiriladi).
   */
  async pushDeviceUpdate(agentId: string): Promise<void> {
    const sock = this.sockets.get(agentId);
    if (!sock) return;
    const devices = await this.loadDevices(agentId);
    sock.emit('agent:devices:update', { devices });
  }

  @SubscribeMessage('agent:cmd:result')
  onResult(
    @ConnectedSocket() _client: Socket,
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

  /**
   * Agent jonli stream'dan yangi kadrni push qiladi. Server bu kadrni
   * shu qurilmaga obuna bo'lgan brauzerlarga (events kanali orqali) tarqatadi.
   */
  @SubscribeMessage('agent:streamFrame')
  onStreamFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deviceId: string; imageBase64: string },
  ): void {
    const agentId = (client.data as any)?.agentId as string | undefined;
    if (!agentId || !payload?.deviceId || !payload.imageBase64) return;
    this.eventsGateway.broadcastStreamFrame(
      payload.deviceId,
      payload.imageBase64,
    );
  }

  @SubscribeMessage('agent:event')
  async onAgentEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deviceId: string; event: Record<string, any> },
  ): Promise<void> {
    const agentId = (client.data as any)?.agentId as string | undefined;
    if (!agentId || !payload?.deviceId) return;
    this.logger.debug(
      `agent ${agentId} event for device ${payload.deviceId}: ${JSON.stringify(payload.event).slice(0, 200)}`,
    );
  }

  private async loadDevices(agentId: string): Promise<AgentDevicePayload[]> {
    const devices = await this.deviceRepo.find({ where: { agentId } });
    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      mode: d.mode,
      credentials: {
        host: d.host,
        port: d.port,
        useHttps: d.useHttps,
        username: d.username,
        password: decryptSecret(d.passwordEnc),
      },
    }));
  }
}
