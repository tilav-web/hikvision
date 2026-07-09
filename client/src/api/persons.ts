import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
  position?: string;
  /** Numeric string (so'm). Bo'sh — kiritilmagan. */
  baseSalary?: string;
  deviceIds?: string[];
  autoSync?: boolean;
}

export function usePerson(id: string | null) {
  return useQuery({
    queryKey: ['persons', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<Person>(`/hikvision/persons/${id}`);
      return data;
    },
  });
}

export function usePersons(
  opts: { q?: string; companyId?: string; skip?: number; take?: number } = {},
) {
  return useQuery({
    queryKey: [
      'persons',
      opts.q ?? '',
      opts.companyId ?? 'all',
      opts.skip ?? 0,
      opts.take ?? 50,
    ],
    // Sahifa/qidiruv o'zgarganda jadval bo'shab ketmasin — avvalgi sahifani
    // yangi ma'lumot kelguncha ushlab turadi.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.q) params.q = opts.q;
      if (opts.companyId) params.companyId = opts.companyId;
      if (opts.skip != null) params.skip = String(opts.skip);
      if (opts.take != null) params.take = String(opts.take);
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
