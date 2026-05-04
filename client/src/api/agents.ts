import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Agent } from './types';

export interface AgentInput {
  name: string;
  companyId?: string;
  hostInfo?: string;
}

export function useAgents(companyId?: string) {
  return useQuery({
    queryKey: ['agents', companyId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (companyId) params.companyId = companyId;
      const { data } = await api.get<Agent[]>('/hikvision/agents', { params });
      return data;
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AgentInput) =>
      (await api.post<Agent>('/hikvision/agents', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      dto: { name?: string; hostInfo?: string };
    }) => (await api.patch<Agent>(`/hikvision/agents/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/agents/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}
