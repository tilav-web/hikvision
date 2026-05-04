import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Person } from './types';

export interface PersonInput {
  companyId?: string;
  employeeNo: string;
  name: string;
  userType?: 'normal' | 'visitor' | 'blackList';
  gender?: 'male' | 'female' | 'unknown';
  cardNo?: string;
  pin?: string;
  phone?: string;
  email?: string;
  deviceIds?: string[];
  autoSync?: boolean;
}

export function usePersons(opts: { q?: string; companyId?: string } = {}) {
  return useQuery({
    queryKey: ['persons', opts.q ?? '', opts.companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.q) params.q = opts.q;
      if (opts.companyId) params.companyId = opts.companyId;
      const { data } = await api.get<{ items: Person[]; total: number }>(
        '/hikvision/persons',
        { params },
      );
      return data;
    },
  });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { dto: PersonInput; file?: File }) => {
      if (vars.file) {
        const fd = new FormData();
        Object.entries(vars.dto).forEach(([k, v]) => {
          if (v === undefined || v === null) return;
          if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
          else fd.append(k, String(v));
        });
        fd.append('file', vars.file);
        const { data } = await api.post('/hikvision/persons', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
      }
      const { data } = await api.post('/hikvision/persons', vars.dto);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; dto: Partial<PersonInput> }) =>
      (await api.patch<Person>(`/hikvision/persons/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/persons/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useSyncPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await api.post<{
          success: string[];
          failed: Array<{ deviceId: string; error: string }>;
        }>(`/hikvision/persons/${id}/sync`)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}

export function useUploadFace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', vars.file);
      const { data } = await api.post(
        `/hikvision/persons/${vars.id}/face`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['persons'] }),
  });
}
