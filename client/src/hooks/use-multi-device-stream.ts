import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const NAMESPACE_URL = `${API_BASE}/events`;

export interface CameraCellState {
  imgUrl: string | null;
  isInitialLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

function emptyCell(): CameraCellState {
  return {
    imgUrl: null,
    isInitialLoading: true,
    error: null,
    lastFetchedAt: null,
  };
}

/**
 * Ko'p-kamerali stream — BITTA socket orqali bir nechta qurilmaga obuna
 * bo'ladi (har kamera uchun alohida socket ochmaydi, L7 muammosini yopadi).
 *
 * Server socketSubs Set orqali bir socketga ko'p obunani allaqachon qo'llaydi;
 * kadrlar deviceId bo'yicha to'g'ri katakka yo'naltiriladi.
 */
export function useMultiDeviceStream(
  deviceIds: string[],
  opts: { fps?: number; enabled?: boolean } = {},
): Record<string, CameraCellState> {
  const fps = Math.max(0.5, Math.min(10, opts.fps ?? 2));
  const enabled = opts.enabled ?? true;
  const token = useAuthStore((s) => s.token);
  const key = deviceIds.join(',');

  const [states, setStates] = useState<Record<string, CameraCellState>>({});
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!enabled || !token || deviceIds.length === 0) {
      setStates({});
      return;
    }
    let aborted = false;

    // Boshlang'ich holat — barchasi yuklanmoqda
    const init: Record<string, CameraCellState> = {};
    deviceIds.forEach((id) => (init[id] = emptyCell()));
    setStates(init);

    const socket: Socket = io(NAMESPACE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const patch = (id: string, p: Partial<CameraCellState>) =>
      setStates((s) => ({ ...s, [id]: { ...(s[id] ?? emptyCell()), ...p } }));

    const onFrame = (payload: { deviceId: string; image: ArrayBuffer }) => {
      if (aborted || !payload?.image || !deviceIds.includes(payload.deviceId)) {
        return;
      }
      const blob = new Blob([payload.image], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const prev = urlsRef.current[payload.deviceId];
      if (prev) URL.revokeObjectURL(prev);
      urlsRef.current[payload.deviceId] = url;
      patch(payload.deviceId, {
        imgUrl: url,
        isInitialLoading: false,
        error: null,
        lastFetchedAt: Date.now(),
      });
    };

    socket.on('connect', () => {
      deviceIds.forEach((id) =>
        socket.emit(
          'stream:subscribe',
          { deviceId: id, fps },
          (res: { ok: boolean; error?: string }) => {
            if (aborted) return;
            if (!res?.ok) {
              patch(id, {
                isInitialLoading: false,
                error: res?.error ?? 'subscribe muvaffaqiyatsiz',
              });
            }
          },
        ),
      );
    });

    socket.on('connect_error', (e) => {
      if (aborted) return;
      deviceIds.forEach((id) =>
        patch(id, { isInitialLoading: false, error: e.message }),
      );
    });

    socket.on('stream:frame', onFrame);

    return () => {
      aborted = true;
      if (socket.connected) {
        deviceIds.forEach((id) => socket.emit('stream:unsubscribe', { deviceId: id }));
      }
      socket.off('stream:frame', onFrame);
      socket.removeAllListeners();
      socket.disconnect();
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = {};
    };
    // key = deviceIds.join(',') — massiv mazmuni o'zgarganda qayta ulanadi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fps, enabled, token]);

  return states;
}
