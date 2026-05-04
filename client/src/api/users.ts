import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User, UserRole } from './types';

export interface UserInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  companyId?: string | null;
  isActive?: boolean;
}

export function useUsers(companyId?: string) {
  return useQuery({
    queryKey: ['users', companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      const { data } = await api.get<User[]>('/users', { params });
      return data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UserInput) =>
      (await api.post<User>('/users', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      dto: { fullName?: string; password?: string; isActive?: boolean };
    }) => (await api.patch<User>(`/users/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
