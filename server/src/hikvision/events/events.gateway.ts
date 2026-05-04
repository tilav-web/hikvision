import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { AccessEventEntity } from '../entities/access-event.entity';
import type { JwtPayload } from '../../auth/jwt.strategy';

const SUPER_ROOM = 'super_admin';
const companyRoom = (companyId: string) => `company:${companyId}`;

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

  constructor(private readonly cfg: ConfigService) {}

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
    this.logger.log(`socket disconnected: ${client.id}`);
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
