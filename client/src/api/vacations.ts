import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Vacation, VacationStatus, VacationType } from './types';

export interface VacationInput {
  personId: string;
  fromDate: string;
  toDate: string;
  type: VacationType;
  status?: VacationStatus;
  reason?: string;
}

export function useVacations(opts: { personId?: string; activeOn?: string } = {}) {
  return useQuery({
    queryKey: ['vacations', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.personId) params.personId = opts.personId;
      if (opts.activeOn) params.activeOn = opts.activeOn;
      const { data } = await api.get<Vacation[]>('/hikvision/vacations', {
        params,
      });
      return data;
    },
  });
}

export function useCreateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: VacationInput) =>
      (await api.post<Vacation>('/hikvision/vacations', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vacations'] }),
  });
}

export function useUpdateVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      dto: Partial<VacationInput>;
    }) =>
      (await api.patch<Vacation>(`/hikvision/vacations/${vars.id}`, vars.dto))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vacations'] }),
  });
}

export function useDeleteVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/vacations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vacations'] }),
  });
}
