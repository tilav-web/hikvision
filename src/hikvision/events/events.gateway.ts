import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessEventEntity } from '../entities/access-event.entity';

/**
 * Real-time event broadcast.
 * Admin panel: const sock = io(serverUrl); sock.on('hik:event', payload => ...)
 */
@WebSocketGateway({
  namespace: '/hikvision',
  cors: { origin: '*', credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`socket disconnected: ${client.id}`);
  }

  emitAccessEvent(event: AccessEventEntity, extra?: { deviceName?: string }) {
    this.server.emit('hik:event', {
      id: event.id,
      deviceId: event.deviceId,
      deviceName: extra?.deviceName,
      personId: event.personId,
      employeeNo: event.employeeNo,
      personName: event.personName,
      category: event.category,
      verifyMode: event.verifyMode,
      majorEvent: event.majorEvent,
      minorEvent: event.minorEvent,
      capturedAt: event.capturedAt,
      pictureUrl: event.pictureUrl,
    });
  }

  emitDeviceStatus(deviceId: string, isOnline: boolean) {
    this.server.emit('hik:device-status', { deviceId, isOnline, at: new Date() });
  }
}
