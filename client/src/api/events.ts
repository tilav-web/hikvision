import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AccessEvent } from './types';

export function useEvents(
  opts: {
    deviceId?: string;
    personId?: string;
    from?: string;
    to?: string;
    skip?: number;
    take?: number;
    companyId?: string;
    /** Bir nechta kategoriya CSV — "accessGranted,accessDenied" */
    category?: string;
    /** Default false: 'unknown' yashirin bo'ladi */
    includeUnknown?: boolean;
  } = {},
) {
  return useQuery({
    queryKey: ['events', opts],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.deviceId) params.deviceId = opts.deviceId;
      if (opts.personId) params.personId = opts.personId;
      if (opts.from) params.from = opts.from;
      if (opts.to) params.to = opts.to;
      if (opts.companyId) params.companyId = opts.companyId;
      if (opts.skip) params.skip = String(opts.skip);
      if (opts.take) params.take = String(opts.take);
      if (opts.category) params.category = opts.category;
      if (opts.includeUnknown) params.includeUnknown = 'true';
      const { data } = await api.get<{ items: AccessEvent[]; total: number }>(
        '/hikvision/events',
        { params },
      );
      return data;
    },
  });
}

export function useCleanupEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opts: { olderThanDays?: number; onlyUnknown?: boolean } = {}) => {
      const params: Record<string, string> = {};
      if (opts.olderThanDays) params.olderThanDays = String(opts.olderThanDays);
      if (opts.onlyUnknown) params.onlyUnknown = 'true';
      const { data } = await api.delete<{ deleted: number; cutoff: string }>(
        '/hikvision/events/cleanup',
        { params },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
