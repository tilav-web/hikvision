export interface DeviceCredentials {
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  password: string;
  timeoutMs?: number;
}

export interface IsapiUserInfo {
  employeeNo: string;
  name: string;
  userType?: 'normal' | 'visitor' | 'blackList';
  gender?: 'male' | 'female' | 'unknown';
  Valid?: { enable: boolean; beginTime: string; endTime: string };
  doorRight?: string;
  RightPlan?: Array<{ doorNo: number; planTemplateNo: string }>;
  password?: string;
}

export interface FaceUploadResult {
  statusCode?: number;
  statusString?: string;
  errorMsg?: string;
  [k: string]: any;
}

export interface DeviceInfo {
  deviceName?: string;
  deviceID?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  firmwareVersion?: string;
  firmwareReleasedDate?: string;
}

export interface ListenerHostConfig {
  id?: number;
  url: string;
  protocolType: 'HTTP' | 'HTTPS';
  parameterFormatType?: 'JSON' | 'XML';
  addressingFormatType?: 'ipaddress' | 'hostname';
  ipAddress?: string;
  hostName?: string;
  portNo?: number;
  httpAuthenticationMethod?: 'none' | 'digest';
}
