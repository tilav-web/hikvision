import { IsapiUserInfo, ListenerHostConfig } from './isapi/types';
import { DevicePool } from './device-pool';
import { SadpDiscovery } from './sadp';
import { StreamManager } from './stream-manager';
import { logger } from './logger';

export type CommandAction =
  | 'inspect'
  | 'discoverDevices'
  | 'ping'
  | 'getDeviceInfo'
  | 'reboot'
  | 'syncTime'
  | 'openDoor'
  | 'setupListener'
  | 'addUser'
  | 'updateUser'
  | 'deleteUser'
  | 'searchUser'
  | 'uploadFace'
  | 'deleteFace'
  | 'addCard'
  | 'deletePerson'
  | 'syncPerson'
  | 'getSnapshot'
  | 'startStream'
  | 'stopStream'
  | 'getStreamFrame';

export interface CommandEnvelope {
  id: string;
  deviceId: string;
  action: CommandAction;
  payload: any;
}

export interface CommandResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class CommandHandler {
  constructor(
    private readonly pool: DevicePool,
    private readonly sadp: SadpDiscovery,
    private readonly streams: StreamManager,
  ) {}

  async execute(cmd: CommandEnvelope): Promise<CommandResult> {
    logger.debug(`exec ${cmd.action} on ${cmd.deviceId}`);
    try {
      const data = await this.dispatch(cmd);
      return { id: cmd.id, success: true, data };
    } catch (e) {
      const error = (e as Error).message;
      logger.error(`cmd ${cmd.action} (${cmd.id}) on ${cmd.deviceId} failed:`, error);
      return { id: cmd.id, success: false, error };
    }
  }

  private async dispatch(cmd: CommandEnvelope): Promise<any> {
    // Agent darajasidagi buyruqlar — deviceId talab qilmaydi
    if (cmd.action === 'inspect') {
      return this.inspect();
    }
    if (cmd.action === 'discoverDevices') {
      return { devices: this.sadp.list() };
    }

    const c = this.pool.clientFor(cmd.deviceId);
    switch (cmd.action) {
      case 'ping':
        return { ok: await c.ping() };

      case 'getDeviceInfo':
        return c.getDeviceInfo();

      case 'reboot':
        await c.reboot();
        return { ok: true };

      case 'syncTime':
        await c.setTimeNow();
        return { ok: true };

      case 'openDoor':
        await c.openDoor(cmd.payload?.doorNo ?? 1);
        return { ok: true };

      case 'setupListener':
        await c.setupListenerHost(cmd.payload as ListenerHostConfig);
        return { ok: true };

      case 'addUser':
        await c.addUser(cmd.payload as IsapiUserInfo);
        return { ok: true };

      case 'updateUser':
        await c.updateUser(cmd.payload as IsapiUserInfo);
        return { ok: true };

      case 'deleteUser':
        await c.deleteUser(cmd.payload.employeeNo);
        return { ok: true };

      case 'searchUser':
        return c.searchUsers({
          employeeNo: cmd.payload?.employeeNo,
          maxResults: cmd.payload?.maxResults ?? 1,
        });

      case 'uploadFace': {
        const buf = Buffer.from(cmd.payload.imageBase64, 'base64');
        return c.uploadFace(cmd.payload.employeeNo, buf);
      }

      case 'deleteFace':
        await c.deleteFace(cmd.payload.employeeNo);
        return { ok: true };

      case 'addCard':
        await c.addCard(cmd.payload.employeeNo, cmd.payload.cardNo);
        return { ok: true };

      case 'syncPerson':
        return this.syncPerson(cmd.deviceId, cmd.payload);

      case 'deletePerson':
        await c.deleteFace(cmd.payload.employeeNo).catch(() => undefined);
        await c.deleteUser(cmd.payload.employeeNo);
        return { ok: true };

      case 'getSnapshot': {
        const channel = Number(cmd.payload?.channel ?? 1);
        const buf = await c.getSnapshot(channel);
        return { imageBase64: buf.toString('base64'), bytes: buf.length };
      }

      case 'startStream': {
        const fps = Number(cmd.payload?.fps ?? 3);
        this.streams.start(cmd.deviceId, c, fps);
        return { ok: true, fps };
      }

      case 'stopStream':
        this.streams.stop(cmd.deviceId);
        return { ok: true };

      case 'getStreamFrame':
        return this.streams.getFrame(cmd.deviceId);

      default:
        throw new Error(`unknown action: ${(cmd as any).action}`);
    }
  }

  /** Agent ko'rayotgan barcha qurilmalar + ping holati. */
  private async inspect(): Promise<{
    devices: Array<{
      id: string;
      name?: string;
      mode: string;
      host: string;
      port: number;
      useHttps: boolean;
      online: boolean;
    }>;
  }> {
    const pings = await this.pool.pingAll();
    const pingMap = new Map(pings.map((p) => [p.id, p.ok]));
    const devices = this.pool.list().map((d) => ({
      id: d.id,
      name: d.name,
      mode: d.mode,
      host: d.credentials.host,
      port: d.credentials.port,
      useHttps: d.credentials.useHttps,
      online: pingMap.get(d.id) ?? false,
    }));
    return { devices };
  }

  private async syncPerson(
    deviceId: string,
    payload: {
      userInfo: IsapiUserInfo;
      imageBase64?: string;
      cardNo?: string;
    },
  ): Promise<{ user: 'added' | 'updated'; face: boolean; card: boolean }> {
    const c = this.pool.clientFor(deviceId);
    const exists = await c.searchUsers({
      employeeNo: payload.userInfo.employeeNo,
      maxResults: 1,
    });

    if (exists.totalMatches > 0) {
      await c.updateUser(payload.userInfo);
    } else {
      await c.addUser(payload.userInfo);
    }

    let face = false;
    if (payload.imageBase64) {
      const buf = Buffer.from(payload.imageBase64, 'base64');
      await c.uploadFace(payload.userInfo.employeeNo, buf);
      face = true;
    }

    let card = false;
    if (payload.cardNo) {
      await c.addCard(payload.userInfo.employeeNo, payload.cardNo).catch(() => undefined);
      card = true;
    }

    return {
      user: exists.totalMatches > 0 ? 'updated' : 'added',
      face,
      card,
    };
  }
}
