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

// Kamera stream'i WebSocket orqali ishlaydi (use-device-stream hook).
// HTTP API'da stream funksiyalari yo'q — events socket'i orqali real-time push.

// ─────── Aparat ↔ DB sinxronlash (reconciliation) ───────

export interface DeviceUser {
  employeeNo: string;
  name: string;
  userType: string | null;
  gender: 'male' | 'female' | 'unknown';
  cardNo: string | null;
  beginTime: string | null;
  endTime: string | null;
  raw: any;
}

export interface CompareResult {
  deviceId: string;
  companyId: string | null;
  total: { device: number; db: number };
  onlyOnDevice: DeviceUser[];
  onlyInDb: Array<{
    id: string;
    employeeNo: string;
    name: string;
    cardNo: string | null;
  }>;
  matched: Array<{ employeeNo: string; name: string; personId: string }>;
  mismatched: Array<{
    employeeNo: string;
    deviceUser: DeviceUser;
    dbPerson: { id: string; name: string; cardNo: string | null };
    diffs: string[];
  }>;
}

export function useDeviceSyncCompare(deviceId: string | null) {
  return useQuery({
    queryKey: ['device-sync-compare', deviceId],
    enabled: !!deviceId,
    staleTime: 30_000,
    queryFn: async () =>
      (await api.get<CompareResult>(`/hikvision/devices/${deviceId}/sync/compare`)).data,
  });
}

export function useImportFromDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { deviceId: string; employeeNos: string[] }) =>
      (
        await api.post<{
          created: Array<{ id: string; employeeNo: string; name: string }>;
          skipped: Array<{ employeeNo: string; reason: string }>;
        }>(`/hikvision/devices/${vars.deviceId}/sync/import`, {
          employeeNos: vars.employeeNos,
        })
      ).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['device-sync-compare', vars.deviceId] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function usePushToDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { deviceId: string; personIds: string[] }) =>
      (
        await api.post<{
          success: Array<{ personId: string; employeeNo: string }>;
          failed: Array<{ personId: string; error: string }>;
        }>(`/hikvision/devices/${vars.deviceId}/sync/push`, {
          personIds: vars.personIds,
        })
      ).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['device-sync-compare', vars.deviceId] });
      qc.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useDeleteFromDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { deviceId: string; employeeNos: string[] }) =>
      (
        await api.post<{
          success: string[];
          failed: Array<{ employeeNo: string; error: string }>;
        }>(`/hikvision/devices/${vars.deviceId}/sync/delete`, {
          employeeNos: vars.employeeNos,
        })
      ).data,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['device-sync-compare', vars.deviceId] });
    },
  });
}

// ─────── Person device sync status (Sprint 3) ───────

export interface PersonDeviceStatus {
  deviceId: string;
  deviceName: string;
  isLinked: boolean;
  linkStatus: string | null;
  onDevice: boolean | 'unknown';
  error: string | null;
}

export function usePersonDeviceStatus(personId: string | null) {
  return useQuery({
    queryKey: ['person-device-status', personId],
    enabled: !!personId,
    queryFn: async () =>
      (
        await api.get<PersonDeviceStatus[]>(
          `/hikvision/persons/${personId}/device-status`,
        )
      ).data,
  });
}
