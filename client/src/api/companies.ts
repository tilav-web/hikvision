import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Company, CompanyStatus } from './types';

const KEY = ['companies'] as const;

export interface CompanyInput {
  name: string;
  slug: string;
  status?: CompanyStatus;
  paidFrom?: string | null;
  paidUntil?: string | null;
  maxDevices?: number;
  maxEmployees?: number;
  contactPhone?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}

export function useCompanies() {
  // /companies faqat super_admin uchun — company_admin uchun so'rov yubormaymiz
  // (aks holda har sahifada kafolatlangan 403 + konsol shovqini).
  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
    enabled: role === 'super_admin',
  });
}

export function useCompany(id: string | null | undefined) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: async () => (await api.get<Company>(`/companies/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CompanyInput) =>
      (await api.post<Company>('/companies', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; dto: Partial<CompanyInput> }) =>
      (await api.patch<Company>(`/companies/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/companies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRotateCompanyToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await api.post<{ apiToken: string }>(`/companies/${id}/rotate-token`)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
