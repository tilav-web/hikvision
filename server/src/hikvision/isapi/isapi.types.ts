export interface DeviceCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps?: boolean;
  timeoutMs?: number;
}

export interface IsapiUserInfo {
  employeeNo: string;
  name: string;
  userType?: 'normal' | 'visitor' | 'blackList' | 'patient' | 'maintenance';
  gender?: 'male' | 'female' | 'unknown';
  Valid?: {
    enable: boolean;
    beginTime: string; // ISO without timezone, e.g. "2025-01-01T00:00:00"
    endTime: string;
  };
  doorRight?: string; // "1" — qaysi eshik
  RightPlan?: Array<{ doorNo: number; planTemplateNo: string }>;
  password?: string;
}

export interface DeviceInfo {
  deviceName: string;
  deviceID: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string;
  firmwareReleasedDate?: string;
}

export interface FaceUploadResult {
  faceLibType: string;
  FDID: string;
  FPID: string;
  statusCode: number;
  statusString: string;
  subStatusCode: string;
}

export interface ListenerHostConfig {
  id: number;
  url: string; // http://server-ip:port/api/hikvision/events/receiver
  protocolType: 'HTTP' | 'HTTPS';
  parameterFormatType?: 'XML' | 'JSON';
  addressingFormatType?: 'ipaddress' | 'hostname';
  hostName?: string;
  ipAddress?: string;
  portNo?: number;
  httpAuthenticationMethod?: 'none' | 'digest';
}
