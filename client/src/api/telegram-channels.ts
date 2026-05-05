import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TelegramChannel {
  id: string;
  companyId: string | null;
  chatId: string;
  title: string | null;
  botStatus:
    | 'administrator'
    | 'creator'
    | 'member'
    | 'restricted'
    | 'left'
    | 'kicked'
    | 'unknown';
  isMember: boolean;
  enabledEvents: string[];
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  company?: { id: string; name: string };
}

export interface ChannelInput {
  chatId: string;
  title?: string;
  companyId?: string;
  enabledEvents?: string[];
  isActive?: boolean;
}

const KEY = ['telegram-channels'] as const;

export function useBotInfo() {
  return useQuery({
    queryKey: ['telegram-bot-info'],
    queryFn: async () =>
      (
        await api.get<{ ready: boolean; username: string | null }>(
          '/telegram/channels/bot-info',
        )
      ).data,
    staleTime: 60_000,
  });
}

export function useTelegramChannels(opts: {
  companyId?: string;
  onlyGlobal?: boolean;
} = {}) {
  return useQuery({
    queryKey: [...KEY, opts.companyId ?? 'all', opts.onlyGlobal ?? false],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (opts.companyId) params.companyId = opts.companyId;
      if (opts.onlyGlobal) params.onlyGlobal = 'true';
      const { data } = await api.get<TelegramChannel[]>(
        '/telegram/channels',
        { params },
      );
      return data;
    },
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChannelInput) =>
      (await api.post<TelegramChannel>('/telegram/channels', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; dto: Partial<ChannelInput> }) =>
      (
        await api.patch<TelegramChannel>(
          `/telegram/channels/${vars.id}`,
          vars.dto,
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/telegram/channels/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTestChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await api.post<{ ok: boolean; error?: string }>(
          `/telegram/channels/${id}/test`,
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
