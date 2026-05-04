import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Attendance, AttendanceStats } from './types';

export function useAttendance(opts: {
  personId?: string;
  from?: string;
  to?: string;
  companyId?: string;
} = {}) {
  return useQuery({
    queryKey: ['attendance', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.personId) params.personId = opts.personId;
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<{ items: Attendance[]; total: number }>(
        '/hikvision/attendance',
        { params },
      );
      return data;
    },
  });
}

export function useAttendanceStats(opts: {
  from?: string;
  to?: string;
  companyId?: string;
} = {}) {
  return useQuery({
    queryKey: ['attendance-stats', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<AttendanceStats>(
        '/hikvision/attendance/stats',
        { params },
      );
      return data;
    },
  });
}

export interface PersonStat {
  personId: string;
  personName: string;
  employeeNo: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  totalLateMinutes: number;
  totalWorkedMinutes: number;
  totalLunchOverstay: number;
}

export interface DayStat {
  date: string;
  total: number;
  present: number;
  late: number;
  absent: number;
  totalLateMinutes: number;
}

export function usePerPersonStats(opts: {
  from?: string;
  to?: string;
  companyId?: string;
} = {}) {
  return useQuery({
    queryKey: ['per-person-stats', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<PersonStat[]>(
        '/hikvision/attendance/per-person',
        { params },
      );
      return data;
    },
  });
}

export function usePerDayStats(opts: {
  from?: string;
  to?: string;
  companyId?: string;
} = {}) {
  return useQuery({
    queryKey: ['per-day-stats', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<DayStat[]>(
        '/hikvision/attendance/per-day',
        { params },
      );
      return data;
    },
  });
}
