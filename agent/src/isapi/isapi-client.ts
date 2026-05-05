import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import * as https from 'https';
import FormData from 'form-data';
import { XMLParser } from 'fast-xml-parser';
import { DigestChallenge, buildAuthorizationHeader, parseWwwAuthenticate } from './digest-auth';
import {
  DeviceCredentials,
  DeviceInfo,
  FaceUploadResult,
  IsapiUserInfo,
  ListenerHostConfig,
} from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

function escapeXml(s: string | number | boolean): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toXml(rootName: string, obj: Record<string, any>): string {
  const inner = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><${rootName}>${inner}</${rootName}>`;
}

function maybeParseXml(data: any, contentType?: string): any {
  if (data == null) return data;
  if (typeof data !== 'string') return data;
  const looksXml =
    (contentType && /xml/i.test(contentType)) || data.trimStart().startsWith('<');
  if (!looksXml) return data;
  try {
    return xmlParser.parse(data);
  } catch {
    return data;
  }
}

export class IsapiClient {
  private readonly http: AxiosInstance;
  private cachedChallenge: DigestChallenge | null = null;
  private nonceCount = 0;

  constructor(private readonly creds: DeviceCredentials) {
    const scheme = creds.useHttps ? 'https' : 'http';
    this.http = axios.create({
      baseURL: `${scheme}://${creds.host}:${creds.port}`,
      timeout: creds.timeoutMs ?? 15000,
      validateStatus: () => true,
      headers: { Accept: 'application/json' },
      ...(creds.useHttps
        ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
        : {}),
    });
  }

  // FormData stream → Buffer (401-retry da qayta-foydalanish uchun).
  private materializeBody(config: AxiosRequestConfig): {
    data: any;
    headers: Record<string, any>;
  } {
    const data = config.data;
    const baseHeaders: Record<string, any> = { ...(config.headers ?? {}) };
    if (
      data &&
      typeof (data as any).getBuffer === 'function' &&
      typeof (data as any).getHeaders === 'function'
    ) {
      const fd = data as FormData;
      const buf = fd.getBuffer();
      return {
        data: buf,
        headers: {
          ...baseHeaders,
          ...fd.getHeaders(),
          'Content-Length': fd.getLengthSync(),
        },
      };
    }
    return { data, headers: baseHeaders };
  }

  private buildAuth(method: Method, path: string): string | null {
    if (!this.cachedChallenge) return null;
    const nc = (++this.nonceCount).toString(16).padStart(8, '0');
    return buildAuthorizationHeader({
      username: this.creds.username,
      password: this.creds.password,
      method: String(method).toUpperCase(),
      uri: path,
      challenge: this.cachedChallenge,
      nc,
    });
  }

  private async request<T = any>(
    method: Method,
    path: string,
    config: AxiosRequestConfig = {},
  ): Promise<AxiosResponse<T>> {
    const { data, headers: baseHeaders } = this.materializeBody(config);

    const send = (extraHeaders: Record<string, any> = {}) =>
      this.http.request<T>({
        ...config,
        method,
        url: path,
        data,
        headers: { ...baseHeaders, ...extraHeaders },
      });

    let res!: AxiosResponse<T>;
    for (let attempt = 0; attempt < 2; attempt++) {
      const preAuth = this.buildAuth(method, path);
      res = await send(preAuth ? { Authorization: preAuth } : {});
      if (res.status !== 401) break;

      const wwwAuth = (res.headers['www-authenticate'] ||
        res.headers['WWW-Authenticate']) as string | undefined;
      const challenge = wwwAuth ? parseWwwAuthenticate(wwwAuth) : null;
      if (challenge) {
        this.cachedChallenge = challenge;
        this.nonceCount = 0;
        const auth = this.buildAuth(method, path);
        if (auth) res = await send({ Authorization: auth });
        break;
      }
      // 401 + WWW-Authenticate yo'q: keshlangan challenge stale bo'lishi mumkin —
      // keshni tashlab, ikkinchi urinishda toza so'rov qilamiz (toza challenge keladi).
      if (preAuth) {
        this.cachedChallenge = null;
        this.nonceCount = 0;
        continue;
      }
      break;
    }

    const ct = (res.headers['content-type'] || res.headers['Content-Type']) as string | undefined;
    res.data = maybeParseXml(res.data, ct) as T;
    return res;
  }

  private throwIfNotOk(res: AxiosResponse, ctx: string): void {
    if (res.status < 200 || res.status >= 300) {
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      throw new Error(`ISAPI ${ctx} failed: ${res.status} ${body?.slice(0, 500)}`);
    }
  }

  /**
   * Qurilmadan jonli kadr (JPEG snapshot) olish. ISAPI:
   *   GET /ISAPI/Streaming/channels/<channelNo>01/picture
   * Default channelNo=1 (asosiy oqim). Buffer qaytadi, content-type'ni
   * tekshiramiz — image/* bo'lmasa xato.
   */
  async getSnapshot(channelNo = 1): Promise<Buffer> {
    const path = `/ISAPI/Streaming/channels/${channelNo}01/picture`;
    const res = await this.request<ArrayBuffer>('GET', path, {
      responseType: 'arraybuffer',
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`ISAPI getSnapshot failed: ${res.status}`);
    }
    const ctRaw: unknown =
      res.headers['content-type'] ?? res.headers['Content-Type'];
    let ct = '';
    if (typeof ctRaw === 'string') ct = ctRaw.toLowerCase();
    else if (Array.isArray(ctRaw) && typeof ctRaw[0] === 'string') {
      ct = ctRaw[0].toLowerCase();
    }
    if (!ct.startsWith('image/')) {
      throw new Error(`unexpected content-type: ${ct || 'none'}`);
    }
    // axios responseType=arraybuffer → Buffer.from buffer'i sifatida qaytaramiz.
    return Buffer.from(res.data as ArrayBuffer);
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/ISAPI/System/deviceInfo?format=json');
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const res = await this.request('GET', '/ISAPI/System/deviceInfo?format=json');
    this.throwIfNotOk(res, 'getDeviceInfo');
    const d = (res.data as any).DeviceInfo ?? res.data;
    return {
      deviceName: d.deviceName,
      deviceID: d.deviceID,
      model: d.model,
      serialNumber: d.serialNumber,
      macAddress: d.macAddress,
      firmwareVersion: d.firmwareVersion,
      firmwareReleasedDate: d.firmwareReleasedDate,
    };
  }

  async reboot(): Promise<void> {
    const res = await this.request('PUT', '/ISAPI/System/reboot');
    this.throwIfNotOk(res, 'reboot');
  }

  async setTimeNow(): Promise<void> {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Time><timeMode>manual</timeMode><localTime>${now}</localTime><timeZone>CST-5:00:00</timeZone></Time>`;
    const res = await this.request('PUT', '/ISAPI/System/time', {
      data: xml,
      headers: { 'Content-Type': 'application/xml' },
    });
    this.throwIfNotOk(res, 'setTimeNow');
  }

  async openDoor(doorNo = 1): Promise<void> {
    const body = { RemoteControlDoor: { cmd: 'open' } };
    const res = await this.request(
      'PUT',
      `/ISAPI/AccessControl/RemoteControl/door/${doorNo}?format=json`,
      {
        data: body,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    this.throwIfNotOk(res, 'openDoor');
  }

  async setupListenerHost(cfg: ListenerHostConfig): Promise<void> {
    const parsed = new URL(cfg.url);
    const ip = cfg.ipAddress ?? parsed.hostname;
    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    const explicitPort = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;
    const port = cfg.portNo ?? explicitPort;
    const path = parsed.pathname + (parsed.search || '');

    const fields: Record<string, any> = {
      id: cfg.id ?? 1,
      url: path,
      protocolType: cfg.protocolType,
      parameterFormatType: cfg.parameterFormatType ?? 'JSON',
      addressingFormatType: cfg.addressingFormatType ?? 'ipaddress',
      ipAddress: ip,
      portNo: port,
      httpAuthenticationMethod: cfg.httpAuthenticationMethod ?? 'none',
    };
    if (cfg.hostName) fields.hostName = cfg.hostName;

    const xml = toXml('HttpHostNotification', fields);
    const res = await this.request(
      'PUT',
      `/ISAPI/Event/notification/httpHosts/${cfg.id ?? 1}`,
      {
        data: xml,
        headers: { 'Content-Type': 'application/xml' },
      },
    );
    this.throwIfNotOk(res, 'setupListenerHost');
  }

  private normalizeUser(u: IsapiUserInfo): IsapiUserInfo {
    return {
      ...u,
      Valid:
        u.Valid ?? {
          enable: true,
          beginTime: '2020-01-01T00:00:00',
          endTime: '2037-12-31T23:59:59',
        },
    };
  }

  async addUser(user: IsapiUserInfo): Promise<void> {
    const body = { UserInfo: this.normalizeUser(user) };
    const res = await this.request('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'addUser');
  }

  async updateUser(user: IsapiUserInfo): Promise<void> {
    const body = { UserInfo: this.normalizeUser(user) };
    const res = await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'updateUser');
  }

  async deleteUser(employeeNo: string): Promise<void> {
    const body = {
      UserInfoDelCond: {
        EmployeeNoList: [{ employeeNo }],
      },
    };
    const res = await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Delete?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'deleteUser');
  }

  async searchUsers(opts: { employeeNo?: string; maxResults?: number } = {}): Promise<{
    totalMatches: number;
    users: any[];
  }> {
    const body = {
      UserInfoSearchCond: {
        searchID: Date.now().toString(),
        searchResultPosition: 0,
        maxResults: opts.maxResults ?? 30,
        ...(opts.employeeNo ? { EmployeeNoList: [{ employeeNo: opts.employeeNo }] } : {}),
      },
    };
    const res = await this.request('POST', '/ISAPI/AccessControl/UserInfo/Search?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'searchUsers');
    const r = (res.data as any).UserInfoSearch ?? res.data;
    return {
      totalMatches: r.totalMatches ?? 0,
      users: r.UserInfo ?? [],
    };
  }

  /**
   * Aparatdagi BARCHA userlarni paginatsiya orqali yig'adi.
   * Server tomondan reconciliation/sync uchun.
   *
   *  - pageSize: bir so'rovda ko'pi bilan necha (Hikvision odatda 30 chegarasi)
   *  - hardLimit: xavfsizlik chegarasi — cheksiz aylanmaslik uchun (default 10000)
   *
   * Hikvision javobida `responseStatusStrg` "MORE" yoki "OK"; "OK" — oxirgi sahifa.
   */
  async enumerateUsers(
    opts: { pageSize?: number; hardLimit?: number } = {},
  ): Promise<{ totalMatches: number; users: any[] }> {
    const pageSize = Math.max(1, Math.min(50, opts.pageSize ?? 30));
    const hardLimit = opts.hardLimit ?? 10_000;
    const searchID = `enum_${Date.now()}`;

    const collected: any[] = [];
    let position = 0;
    let total = 0;

    while (collected.length < hardLimit) {
      const body = {
        UserInfoSearchCond: {
          searchID,
          searchResultPosition: position,
          maxResults: pageSize,
        },
      };
      const res = await this.request(
        'POST',
        '/ISAPI/AccessControl/UserInfo/Search?format=json',
        { data: body, headers: { 'Content-Type': 'application/json' } },
      );
      this.throwIfNotOk(res, 'enumerateUsers');
      const r = (res.data as any).UserInfoSearch ?? res.data;
      const users: any[] = r.UserInfo ?? [];
      total = r.totalMatches ?? collected.length + users.length;
      if (users.length === 0) break;
      collected.push(...users);
      const status = String(r.responseStatusStrg ?? 'OK').toUpperCase();
      if (status !== 'MORE' && users.length < pageSize) break;
      position += users.length;
    }

    return { totalMatches: total, users: collected };
  }

  async uploadFace(employeeNo: string, jpeg: Buffer): Promise<FaceUploadResult> {
    const form = new FormData();
    const meta = { faceLibType: 'blackFD', FDID: '1', FPID: employeeNo };
    form.append('FaceDataRecord', JSON.stringify(meta), {
      contentType: 'application/json',
    });
    form.append('FaceImage', jpeg, {
      filename: `${employeeNo}.jpg`,
      contentType: 'image/jpeg',
    });

    const res = await this.request('POST', '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', {
      data: form,
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    this.throwIfNotOk(res, 'uploadFace');
    return res.data as FaceUploadResult;
  }

  async deleteFace(employeeNo: string): Promise<void> {
    const body = {
      FaceInfoDelCond: {
        EmployeeNoList: [{ employeeNo }],
        faceLibType: 'blackFD',
        FDID: '1',
      },
    };
    const res = await this.request(
      'PUT',
      '/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=1&faceLibType=blackFD',
      {
        data: body,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    this.throwIfNotOk(res, 'deleteFace');
  }

  async addCard(employeeNo: string, cardNo: string): Promise<void> {
    const body = {
      CardInfo: {
        employeeNo,
        cardNo,
        cardType: 'normalCard',
      },
    };
    const res = await this.request('POST', '/ISAPI/AccessControl/CardInfo/Record?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'addCard');
  }
}
