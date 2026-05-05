import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Device, DeviceMode } from './types';

export interface DeviceInput {
  name: string;
  companyId?: string;
  agentId?: string;
  mode?: DeviceMode;
  host: string;
  port?: number;
  useHttps?: boolean;
  username: string;
  password: string;
  location?: string;
}

export function useDevices(opts: { companyId?: string; agentId?: string } = {}) {
  return useQuery({
    queryKey: ['devices', opts.companyId ?? 'all', opts.agentId ?? 'all'],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.companyId) params.companyId = opts.companyId;
      if (opts.agentId) params.agentId = opts.agentId;
      const { data } = await api.get<Device[]>('/hikvision/devices', { params });
      return data;
    },
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: DeviceInput) =>
      (await api.post<Device>('/hikvision/devices', dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; dto: Partial<DeviceInput> }) =>
      (await api.patch<Device>(`/hikvision/devices/${vars.id}`, vars.dto)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hikvision/devices/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useTestDevice() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ ok: boolean; info?: any; error?: string }>(`/hikvision/devices/${id}/test`)).data,
  });
}

export function useRebootDevice() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ ok: boolean }>(`/hikvision/devices/${id}/reboot`)).data,
  });
}

export function useOpenDoor() {
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ ok: boolean }>(`/hikvision/devices/${id}/open-door`)).data,
  });
}

/**
 * Bitta JPEG snapshot oladi va blob URL qaytaradi.
 * Hookda har poll iteratsiyasida chaqirilib, oldingi URL revoke qilinadi.
 */
export async function fetchDeviceSnapshot(
  deviceId: string,
  channel = 1,
): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `/hikvision/devices/${deviceId}/snapshot`,
    { responseType: 'blob', params: { channel } },
  );
  return data;
}
