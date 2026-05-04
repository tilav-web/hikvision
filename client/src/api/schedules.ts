import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Schedule } from './types';

export interface ScheduleInput {
  name: string;
  companyId?: string;
  startTime: string;
  endTime: string;
  workingDays?: number;
  graceMinutes?: number;
  lateThresholdMinutes?: number;
  earlyLeaveThresholdMinutes?: number;
  penaltyPerLateMinute?: string;
  bonusPerEarlyMinute?: string;
  lunchMode?: 'none' | 'fixed' | 'flexible';
  lunchStart?: string;
  lunchEnd?: string;
  lunchDurationMinutes?: number;
  isActive?: boolean;
}

export function useSchedules(companyId?: string) {
  return useQuery({
    queryKey: ['schedules', companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      const { data } = await api.get<Schedule[]>('/hikvision/schedules', { params });
      return data;
    },
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: ScheduleInput) =>
      (await api.post<Schedule>('/hikvision/schedules', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; dto: Partial<ScheduleInput> }) =>
      (await api.patch<Schedule>(`/hikvision/schedules/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/schedules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}
