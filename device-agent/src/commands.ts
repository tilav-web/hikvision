import { IsapiClient } from './isapi/isapi-client';
import { IsapiUserInfo } from './isapi/types';
import { logger } from './logger';

export type CommandAction =
  | 'ping'
  | 'addUser'
  | 'updateUser'
  | 'deleteUser'
  | 'searchUser'
  | 'uploadFace'
  | 'deleteFace'
  | 'addCard'
  | 'syncPerson';

export interface CommandEnvelope {
  id: string;
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
  private client: IsapiClient | null;

  constructor(client: IsapiClient | null) {
    this.client = client;
  }

  setClient(client: IsapiClient): void {
    this.client = client;
  }

  private requireClient(): IsapiClient {
    if (!this.client) {
      throw new Error('aparat ma\'lumotlari hali olinmagan (server welcome kutilyapti)');
    }
    return this.client;
  }

  async execute(cmd: CommandEnvelope): Promise<CommandResult> {
    logger.debug(`exec ${cmd.action}`, cmd.payload);
    try {
      const data = await this.dispatch(cmd);
      return { id: cmd.id, success: true, data };
    } catch (e) {
      const error = (e as Error).message;
      logger.error(`cmd ${cmd.action} (${cmd.id}) failed:`, error);
      return { id: cmd.id, success: false, error };
    }
  }

  private async dispatch(cmd: CommandEnvelope): Promise<any> {
    const c = this.requireClient();
    switch (cmd.action) {
      case 'ping':
        return { ok: await c.ping() };

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
        return this.syncPerson(cmd.payload);

      default:
        throw new Error(`unknown action: ${(cmd as any).action}`);
    }
  }

  // Yuqori darajali helper: bitta person'ni to'liq sinxronlaydi.
  // Server tomonidan toIsapiUser dan kelgan userInfo + ixtiyoriy face base64.
  private async syncPerson(payload: {
    userInfo: IsapiUserInfo;
    imageBase64?: string;
    cardNo?: string;
  }): Promise<{
    user: 'added' | 'updated';
    face: boolean;
    card: boolean;
  }> {
    const c = this.requireClient();
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
