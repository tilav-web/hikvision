import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Holiday } from './types';

export interface HolidayInput {
  date: string;
  name: string;
}

export function useHolidays(opts: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['holidays', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      const { data } = await api.get<Holiday[]>('/hikvision/holidays', {
        params,
      });
      return data;
    },
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: HolidayInput) =>
      (await api.post<Holiday>('/hikvision/holidays', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/holidays/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}
