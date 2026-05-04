import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import * as https from 'https';
import FormData from 'form-data';
import { XMLParser } from 'fast-xml-parser';
import { DigestChallenge, buildAuthorizationHeader, parseWwwAuthenticate } from './digest-auth';
import { DeviceCredentials, FaceUploadResult, IsapiUserInfo } from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

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

  async ping(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/ISAPI/System/deviceInfo?format=json');
      return res.status >= 200 && res.status < 300;
    } catch {
      return false;
    }
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
