import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<Company[]>('/companies')).data,
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
