import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Penalty, PenaltyType } from './types';

export interface PenaltyInput {
  personId: string;
  date: string;
  type: PenaltyType;
  amount: string;
  reason?: string;
  companyId?: string;
}

export function usePenalties(opts: {
  personId?: string;
  from?: string;
  to?: string;
  type?: PenaltyType;
  companyId?: string;
} = {}) {
  return useQuery({
    queryKey: ['penalties', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.personId) params.personId = opts.personId;
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.type) params.type = opts.type;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<{
        items: Penalty[];
        totalPenalty: number;
        totalBonus: number;
        net: number;
      }>('/hikvision/penalties', { params });
      return data;
    },
  });
}

export function useCreatePenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: PenaltyInput) =>
      (await api.post<Penalty>('/hikvision/penalties', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penalties'] }),
  });
}

export function useDeletePenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/penalties/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penalties'] }),
  });
}
