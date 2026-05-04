export type CompanyStatus = 'active' | 'disabled';
export type DeviceMode = 'entry' | 'exit' | 'both';
export type UserRole = 'super_admin' | 'company_admin';

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  paidFrom: string | null;
  paidUntil: string | null;
  maxDevices: number;
  maxEmployees: number;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  companyId: string | null;
  name: string;
  token: string;
  hostInfo: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  companyId: string | null;
  agentId: string | null;
  name: string;
  mode: DeviceMode;
  host: string;
  port: number;
  useHttps: boolean;
  username: string;
  serialNo: string | null;
  model: string | null;
  firmwareVersion: string | null;
  macAddress: string | null;
  location: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  listenerConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  companyId: string | null;
  employeeNo: string;
  name: string;
  userType: 'normal' | 'visitor' | 'blackList' | 'patient' | 'maintenance';
  gender: 'male' | 'female' | 'unknown';
  beginTime: string | null;
  endTime: string | null;
  faceImagePath: string | null;
  cardNo: string | null;
  phone: string | null;
  email: string | null;
  externalUserId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deviceLinks?: Array<{
    id: string;
    deviceId: string;
    status: 'pending' | 'synced' | 'failed';
    faceSynced: boolean;
    cardSynced: boolean;
    syncedAt: string | null;
    lastError: string | null;
    device?: Device;
  }>;
}
