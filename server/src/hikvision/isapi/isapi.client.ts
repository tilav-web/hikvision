import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import * as https from 'https';
import { Logger } from '@nestjs/common';
import FormData from 'form-data';
import { XMLParser } from 'fast-xml-parser';
import { DigestChallenge, buildAuthorizationHeader, parseWwwAuthenticate } from './digest-auth';
import {
  DeviceCredentials,
  DeviceInfo,
  FaceUploadResult,
  IsapiUserInfo,
  ListenerHostConfig,
} from './isapi.types';

/**
 * ISAPI client — har bir aparat uchun bitta nusxa.
 * - Digest Auth qo'lda amalga oshiriladi (ikki qadamli 401 → re-request).
 * - JSON response default. XML kerak bo'lsa `format=xml` ishlatamiz.
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/** TZ'dagi UTC offset (daqiqada), DST'ni ham hisobga oladi. */
function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  let hour = g('hour');
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), hour, g('minute'), g('second'));
  return Math.round((asUTC - at.getTime()) / 60000);
}

/**
 * Hikvision `System/time` uchun mahalliy devor vaqti + timeZone qatorini beradi.
 * Hikvision teskari POSIX konvensiyasidan foydalanadi: UTC+5 → "CST-5:00:00".
 */
function hikTime(tz: string): { localTime: string; timeZone: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  let hh = g('hour');
  if (hh === '24') hh = '00';
  const localTime = `${g('year')}-${g('month')}-${g('day')}T${hh}:${g('minute')}:${g('second')}`;

  const offMin = tzOffsetMinutes(tz, now);
  const sign = offMin >= 0 ? '-' : '+'; // Hikvision teskari belgisi
  const abs = Math.abs(offMin);
  const oh = Math.floor(abs / 60);
  const om = abs % 60;
  const timeZone = `CST${sign}${oh}:${String(om).padStart(2, '0')}:00`;
  return { localTime, timeZone };
}

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
  private readonly logger = new Logger(IsapiClient.name);
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
      // Aparat self-signed sertifikat ishlatadi — tekshirishni o'chirish kerak
      ...(creds.useHttps
        ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
        : {}),
    });
  }

  // ───────────────────────── Quyi daraja ─────────────────────────

  // FormData stream'ni Buffer'ga aylantirib qaytaradi, shunda 401-retry'da
  // body qayta yuborilishi mumkin (stream bir martagina o'qiladi).
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

    // Keshlangan challenge bo'lsa, birinchi so'rovni darhol auth bilan jo'natamiz.
    const preAuth = this.buildAuth(method, path);
    let res = await send(preAuth ? { Authorization: preAuth } : {});

    if (res.status === 401) {
      const wwwAuth = (res.headers['www-authenticate'] ||
        res.headers['WWW-Authenticate']) as string | undefined;
      const challenge = wwwAuth ? parseWwwAuthenticate(wwwAuth) : null;
      if (!challenge) {
        this.logger.warn(`No digest challenge for ${method} ${path}`);
      } else {
        this.cachedChallenge = challenge;
        this.nonceCount = 0;
        const auth = this.buildAuth(method, path);
        if (auth) res = await send({ Authorization: auth });
      }
    }

    // Hikvision firmware'lari ?format=json bo'lsa ham ko'pincha XML qaytaradi.
    // Avtomatik parse qilamiz, kod yuqori qatlamlarida JSON bilan ishlasin.
    const ct = (res.headers['content-type'] || res.headers['Content-Type']) as string | undefined;
    res.data = maybeParseXml(res.data, ct) as T;
    return res;
  }

  private ok(res: AxiosResponse): boolean {
    return res.status >= 200 && res.status < 300;
  }

  private throwIfNotOk(res: AxiosResponse, ctx: string): void {
    if (!this.ok(res)) {
      const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      throw new Error(`ISAPI ${ctx} failed: ${res.status} ${body?.slice(0, 500)}`);
    }
  }

  // ───────────────────────── System ─────────────────────────

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

  async ping(): Promise<boolean> {
    try {
      await this.getDeviceInfo();
      return true;
    } catch (e) {
      this.logger.warn(`ping failed: ${(e as Error).message}`);
      return false;
    }
  }

  async reboot(): Promise<void> {
    const res = await this.request('PUT', '/ISAPI/System/reboot');
    this.throwIfNotOk(res, 'reboot');
  }

  async setTimeNow(): Promise<void> {
    // MUHIM: Hikvision `localTime` MAHALLIY devor vaqtini kutadi (UTC emas).
    // Ilgari UTC instant yuborilardi → soat TZ offsetiga (UZ uchun 5s) siljirdi.
    const tz = process.env.TZ_DEFAULT || 'Asia/Tashkent';
    const { localTime, timeZone } = hikTime(tz);
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Time><timeMode>manual</timeMode><localTime>${localTime}</localTime><timeZone>${timeZone}</timeZone></Time>`;
    const res = await this.request('PUT', '/ISAPI/System/time', {
      data: xml,
      headers: { 'Content-Type': 'application/xml' },
    });
    this.throwIfNotOk(res, 'setTimeNow');
  }

  // ───────────────────────── User (Person) CRUD ─────────────────────────

  /** Aparatga yangi user qo'shish (ID majburiy). */
  async addUser(user: IsapiUserInfo): Promise<void> {
    const body = { UserInfo: this.normalizeUser(user) };
    const res = await this.request('POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'addUser');
  }

  /** Mavjud userni qisman tahrirlash. */
  async updateUser(user: IsapiUserInfo): Promise<void> {
    const body = { UserInfo: this.normalizeUser(user) };
    const res = await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'updateUser');
  }

  /** Userni o'chirish (employeeNo bo'yicha). */
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

  /** Aparatdagi barcha userlarni tozalash. */
  async deleteAllUsers(): Promise<void> {
    const body = { UserInfoDelCond: { clearAll: true } };
    const res = await this.request('PUT', '/ISAPI/AccessControl/UserInfo/Delete?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'deleteAllUsers');
  }

  /** Userlarni qidirish. searchID — har so'rov uchun unikal string. */
  async searchUsers(opts: {
    searchID?: string;
    searchResultPosition?: number;
    maxResults?: number;
    employeeNo?: string;
    name?: string;
  }): Promise<{ totalMatches: number; users: any[] }> {
    const body = {
      UserInfoSearchCond: {
        searchID: opts.searchID || `srch_${Date.now()}`,
        searchResultPosition: opts.searchResultPosition ?? 0,
        maxResults: opts.maxResults ?? 30,
        ...(opts.employeeNo ? { EmployeeNoList: [{ employeeNo: opts.employeeNo }] } : {}),
        ...(opts.name ? { name: opts.name } : {}),
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

  async getUserCount(): Promise<number> {
    const res = await this.request('GET', '/ISAPI/AccessControl/UserInfo/Count?format=json');
    this.throwIfNotOk(res, 'getUserCount');
    const r = (res.data as any).UserInfoCount ?? res.data;
    return r.userNumber ?? 0;
  }

  private normalizeUser(u: IsapiUserInfo): IsapiUserInfo {
    return {
      employeeNo: u.employeeNo,
      name: u.name,
      userType: u.userType ?? 'normal',
      gender: u.gender,
      Valid:
        u.Valid ??
        ({
          enable: true,
          beginTime: '2020-01-01T00:00:00',
          endTime: '2037-12-31T23:59:59',
        } as IsapiUserInfo['Valid']),
      doorRight: u.doorRight ?? '1',
      RightPlan: u.RightPlan ?? [{ doorNo: 1, planTemplateNo: '1' }],
      ...(u.password ? { password: u.password } : {}),
    };
  }

  // ───────────────────────── Yuz rasmi (FaceData) ─────────────────────────

  /**
   * Userga yuz rasmini biriktirish.
   * Aparat multipart/form-data kutadi: birinchi part — JSON metadata, ikkinchi — JPEG fayl.
   */
  async uploadFace(employeeNo: string, jpeg: Buffer): Promise<FaceUploadResult> {
    const form = new FormData();
    const meta = {
      faceLibType: 'blackFD',
      FDID: '1',
      FPID: employeeNo,
    };
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

  /** Userning yuz ma'lumotini o'chirish. */
  async deleteFace(employeeNo: string): Promise<void> {
    const body = {
      FaceInfoDelCond: {
        FDID: '1',
        faceLibType: 'blackFD',
        EmployeeNoList: [{ employeeNo }],
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

  // ───────────────────────── Karta ─────────────────────────

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

  async deleteCard(cardNo: string): Promise<void> {
    const body = { CardInfoDelCond: { CardNoList: [{ cardNo }] } };
    const res = await this.request('PUT', '/ISAPI/AccessControl/CardInfo/Delete?format=json', {
      data: body,
      headers: { 'Content-Type': 'application/json' },
    });
    this.throwIfNotOk(res, 'deleteCard');
  }

  // ───────────────────────── Eshik ─────────────────────────

  /** Eshikni masofadan ochish. doorNo default 1. */
  /** Jonli kadr (JPEG) — ISAPI: GET /Streaming/channels/<channelNo>01/picture */
  async getSnapshot(channelNo = 1): Promise<Buffer> {
    const res = await this.request<ArrayBuffer>(
      'GET',
      `/ISAPI/Streaming/channels/${channelNo}01/picture`,
      { responseType: 'arraybuffer' },
    );
    this.throwIfNotOk(res, 'getSnapshot');
    return Buffer.from(res.data);
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

  // ───────────────────────── Event Listener (Host Notification) ─────────────────────────

  /**
   * Aparatga "event'larni shu URL ga yubor" deb aytamiz.
   * Aparat oldin mavjud listener'ni almashtiradi (id=1).
   */
  async setupListenerHost(cfg: ListenerHostConfig): Promise<void> {
    // Aparat URL'ni 3 bo'lakda kutadi: ipAddress/hostName, portNo, url (path).
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

  async getListenerHosts(): Promise<any> {
    const res = await this.request('GET', '/ISAPI/Event/notification/httpHosts?format=json');
    this.throwIfNotOk(res, 'getListenerHosts');
    return res.data;
  }

  /** Tekshirish so'rovi: aparatga 'test' POST yuboradi. */
  async testListenerHost(id = 1): Promise<void> {
    const res = await this.request(
      'POST',
      `/ISAPI/Event/notification/httpHosts/${id}/test?format=json`,
    );
    this.throwIfNotOk(res, 'testListenerHost');
  }
}
