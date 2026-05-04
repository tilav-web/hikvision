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
