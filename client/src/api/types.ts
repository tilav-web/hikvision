export type CompanyStatus = 'active' | 'disabled';
export type DeviceMode = 'entry' | 'exit' | 'both';
export type UserRole = 'super_admin' | 'company_admin';

export interface Company {
  id: string;
  name: string;
  slug: string;
  apiToken: string;
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
  companyId: string;
  name: string;
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
  scheduleId: string | null;
  position: string | null;
  baseSalary: string | null;
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

export interface Schedule {
  id: string;
  companyId: string;
  name: string;
  startTime: string;
  endTime: string;
  workingDays: number;
  graceMinutes: number;
  lateThresholdMinutes: number;
  earlyLeaveThresholdMinutes: number;
  penaltyPerLateMinute: string;
  bonusPerEarlyMinute: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'partial';

export interface Attendance {
  id: string;
  companyId: string;
  personId: string;
  scheduleId: string | null;
  date: string;
  firstInAt: string | null;
  lastOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number;
  status: AttendanceStatus;
  person?: Person;
}

export type PenaltyType = 'penalty' | 'bonus';
export type PenaltyKind = 'late' | 'early_leave' | 'absent' | 'manual' | 'early_arrival';

export interface Penalty {
  id: string;
  companyId: string;
  personId: string;
  date: string;
  type: PenaltyType;
  kind: PenaltyKind;
  amount: string;
  reason: string | null;
  attendanceId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  person?: Person;
}

export interface AccessEvent {
  id: string;
  companyId: string | null;
  deviceId: string;
  personId: string | null;
  employeeNo: string | null;
  personName: string | null;
  category: 'accessGranted' | 'accessDenied' | 'doorOpen' | 'doorClose' | 'tamper' | 'duress' | 'unknown';
  verifyMode: string;
  direction: 'in' | 'out' | null;
  directionSource: 'device_mode' | 'button' | 'manual' | null;
  capturedAt: string;
  pictureUrl: string | null;
  device?: Device;
  person?: Person;
}

export interface AttendanceStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  partial: number;
  totalLateMinutes: number;
}
