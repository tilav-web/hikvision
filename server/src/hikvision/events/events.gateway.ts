import { forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import * as jwt from 'jsonwebtoken';
import { AccessEventEntity } from '../entities/access-event.entity';
import { DeviceEntity } from '../entities/device.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentsGateway } from '../agents/agents.gateway';
import type { JwtPayload } from '../../auth/jwt.strategy';

const SUPER_ROOM = 'super_admin';
const companyRoom = (companyId: string) => `company:${companyId}`;
const streamRoom = (deviceId: string) => `stream:${deviceId}`;

/**
 * Real-time event broadcast.
 * Client misol:
 *   const sock = io('/events', { auth: { token } });
 *   sock.on('access:event', payload => ...)
 */
@WebSocketGateway({
  namespace: '/events',
  cors: { origin: '*', credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * Stream subscription accountancy:
   *   socketSubs:  socketId → Set<deviceId>   (disconnect'da hammasini stop qilish uchun)
   *   deviceCount: deviceId → number          (faqat 0 → 1 va N → 0 da agentga buyruq)
   */
  private readonly socketSubs = new Map<string, Set<string>>();
  private readonly deviceCount = new Map<string, number>();

  constructor(
    private readonly cfg: ConfigService,
    @InjectRepository(DeviceEntity)
    private readonly deviceRepo: Repository<DeviceEntity>,
    @Inject(forwardRef(() => AgentsGateway))
    private readonly agentsGateway: AgentsGateway,
  ) {}

  handleConnection(client: Socket) {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;
    if (!token) {
      this.logger.warn(`socket reject: token yo'q`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = jwt.verify(
        token,
        this.cfg.getOrThrow<string>('JWT_SECRET'),
      ) as JwtPayload;

      if (payload.role === 'super_admin') {
        client.join(SUPER_ROOM);
      }
      if (payload.companyId) {
        client.join(companyRoom(payload.companyId));
      }
      (client.data as any).user = payload;

      this.logger.log(
        `socket connected: ${client.id} (role=${payload.role}, company=${payload.companyId ?? '-'})`,
      );
    } catch (e) {
      this.logger.warn(`socket reject: invalid token (${(e as Error).message})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // Stream sessiyalarini tozalash — agar foydalanuvchi obuna bo'lib turib
    // browser'ni yopsa, agentga ham stop yetib borishi shart.
    const subs = this.socketSubs.get(client.id);
    if (subs) {
      for (const deviceId of subs) {
        this.releaseStream(deviceId);
      }
      this.socketSubs.delete(client.id);
    }
    this.logger.log(`socket disconnected: ${client.id}`);
  }

  /**
   * Brauzer kameraga obuna bo'ldi. Birinchi obuna bo'lganda agentga
   * `startStream` yuboriladi, keyingilarda — faqat hisoblagich oshadi.
   */
  @SubscribeMessage('stream:subscribe')
  async onStreamSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deviceId: string; fps?: number },
  ): Promise<{ ok: boolean; error?: string }> {
    const user = (client.data as any)?.user as JwtPayload | undefined;
    if (!user || !payload?.deviceId) return { ok: false, error: 'invalid' };

    // RBAC — qurilmani topib companyId tekshiramiz
    const device = await this.deviceRepo.findOne({
      where: { id: payload.deviceId },
    });
    if (!device) return { ok: false, error: 'device not found' };
    if (
      user.role === 'company_admin' &&
      device.companyId !== user.companyId
    ) {
      return { ok: false, error: 'forbidden' };
    }
    if (!device.agentId) {
      return { ok: false, error: 'qurilma agent bilan bog\'lanmagan' };
    }

    // Idempotent — bir socket bir nechta kameralarni kuzatishi mumkin.
    let subs = this.socketSubs.get(client.id);
    if (!subs) {
      subs = new Set();
      this.socketSubs.set(client.id, subs);
    }
    if (subs.has(payload.deviceId)) return { ok: true };
    subs.add(payload.deviceId);

    client.join(streamRoom(payload.deviceId));

    const fps = Math.max(0.5, Math.min(10, payload.fps ?? 3));
    const cur = this.deviceCount.get(payload.deviceId) ?? 0;
    this.deviceCount.set(payload.deviceId, cur + 1);

    // Birinchi viewer (yoki fps yangilash) — agentga yuboramiz.
    try {
      await this.agentsGateway.sendCommand(
        payload.deviceId,
        'startStream',
        { fps },
        10_000,
      );
      return { ok: true };
    } catch (e) {
      // Rollback: counters
      this.releaseStream(payload.deviceId);
      subs.delete(payload.deviceId);
      client.leave(streamRoom(payload.deviceId));
      return { ok: false, error: (e as Error).message };
    }
  }

  /**
   * Brauzer kameradan chiqdi. Hisoblagich 0'ga tushganda agentga `stopStream`.
   */
  @SubscribeMessage('stream:unsubscribe')
  onStreamUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { deviceId: string },
  ): { ok: true } {
    const subs = this.socketSubs.get(client.id);
    if (subs?.has(payload.deviceId)) {
      subs.delete(payload.deviceId);
      client.leave(streamRoom(payload.deviceId));
      this.releaseStream(payload.deviceId);
    }
    return { ok: true };
  }

  /**
   * AgentsGateway tomonidan chaqiriladi: agent yangi kadr push qilganda
   * shu deviceId room'idagi barcha brauzerlarga emit qilamiz.
   */
  broadcastStreamFrame(deviceId: string, imageBase64: string): void {
    this.server
      .to(streamRoom(deviceId))
      .emit('stream:frame', { deviceId, imageBase64 });
  }

  /**
   * Shaxsiy hisoblagich kamayish + 0 bo'lsa agentga stopStream. Boshqalardan
   * (subscribe rollback, disconnect) chaqiriladi.
   */
  private releaseStream(deviceId: string): void {
    const cur = this.deviceCount.get(deviceId) ?? 0;
    const next = Math.max(0, cur - 1);
    if (next === 0) {
      this.deviceCount.delete(deviceId);
      this.agentsGateway
        .sendCommand(deviceId, 'stopStream', {}, 5_000)
        .catch((e) =>
          this.logger.warn(`stopStream xato (${deviceId}): ${(e as Error).message}`),
        );
    } else {
      this.deviceCount.set(deviceId, next);
    }
  }

  emitAccessEvent(event: AccessEventEntity, extra?: { deviceName?: string }) {
    const payload = {
      id: event.id,
      companyId: event.companyId,
      deviceId: event.deviceId,
      deviceName: extra?.deviceName,
      personId: event.personId,
      employeeNo: event.employeeNo,
      personName: event.personName,
      category: event.category,
      verifyMode: event.verifyMode,
      direction: event.direction,
      directionSource: event.directionSource,
      capturedAt: event.capturedAt,
      pictureUrl: event.pictureUrl,
    };

    // Super admin barchasini ko'radi
    this.server.to(SUPER_ROOM).emit('access:event', payload);
    // Tegishli kampaniya admini ko'radi
    if (event.companyId) {
      this.server.to(companyRoom(event.companyId)).emit('access:event', payload);
    }
  }

  emitDeviceStatus(deviceId: string, isOnline: boolean, companyId?: string | null) {
    const payload = { deviceId, isOnline, at: new Date() };
    this.server.to(SUPER_ROOM).emit('device:status', payload);
    if (companyId) {
      this.server.to(companyRoom(companyId)).emit('device:status', payload);
    }
  }
}
