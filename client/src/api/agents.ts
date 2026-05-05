import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Agent } from './types';

export interface AgentInput {
  name: string;
  companyId?: string;
  hostInfo?: string;
}

export interface AgentInspectResult {
  agentId: string;
  agentName: string;
  isOnline: boolean;
  expectedCount: number;
  actualCount: number;
  expected: Array<{ id: string; name: string; host: string; port: number; mode: string }>;
  actual: Array<{
    id: string;
    name?: string;
    mode: string;
    host: string;
    port: number;
    useHttps: boolean;
    online: boolean;
  }>;
  missing: Array<{ id: string; name: string }>;
  extras: Array<{
    id: string;
    name?: string;
    mode: string;
    host: string;
    port: number;
    useHttps: boolean;
    online: boolean;
  }>;
  error?: string;
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

export function useAgentInspect(id: string | null) {
  return useQuery({
    queryKey: ['agents', id, 'inspect'],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<AgentInspectResult>(
        `/hikvision/agents/${id}/inspect`,
      );
      return data;
    },
    refetchInterval: 10_000,
  });
}

export interface DiscoveredDeviceDto {
  serialNumber: string;
  macAddress: string | null;
  ipv4Address: string;
  httpPort: number;
  deviceType: string | null;
  deviceDescription: string | null;
  firmwareVersion: string | null;
  lastSeenAt: number;
}

export interface AgentDiscoveredResult {
  agentId: string;
  agentName: string;
  isOnline: boolean;
  newDevices: DiscoveredDeviceDto[];
  knownDevices: Array<DiscoveredDeviceDto & { dbDeviceId: string; dbName: string }>;
  error?: string;
}

export function useAgentDiscovered(id: string | null) {
  return useQuery({
    queryKey: ['agents', id, 'discovered'],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<AgentDiscoveredResult>(
        `/hikvision/agents/${id}/discovered`,
      );
      return data;
    },
    refetchInterval: 15_000,
  });
}
