import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuditLog {
  id: string;
  companyId: string | null;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export function useAuditLogs(
  opts: { action?: string; skip?: number; take?: number } = {},
) {
  return useQuery({
    queryKey: ['audit-logs', opts.action ?? '', opts.skip ?? 0, opts.take ?? 50],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.action) params.action = opts.action;
      if (opts.skip != null) params.skip = String(opts.skip);
      if (opts.take != null) params.take = String(opts.take);
      const { data } = await api.get<{ items: AuditLog[]; total: number }>(
        '/audit-logs',
        { params },
      );
      return data;
    },
  });
}
