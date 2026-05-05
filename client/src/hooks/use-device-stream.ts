import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const NAMESPACE_URL = `${API_BASE}/events`;

interface StreamState {
  /** Hozirgi blob URL — birinchi muvaffaqiyatli kadrgacha null */
  imgUrl: string | null;
  /** Oxirgi muvaffaqiyatli olish vaqti (ms epoch) */
  lastFetchedAt: number | null;
  /** Birinchi kadrgacha true */
  isInitialLoading: boolean;
  /** Oxirgi xato — subscribe yoki agent xatolari */
  error: string | null;
}

/**
 * Kamera stream — WebSocket asosida (HTTP polling EMAS):
 *
 * Lifecycle:
 *   1. Yagona events socket'ga ulanamiz (token bilan auth)
 *   2. `stream:subscribe { deviceId, fps }` emit — server bu deviceId
 *      uchun birinchi obunachi bo'lsa agentga `startStream` yuboradi
 *   3. Agent har yangi kadrni server'ga push qiladi (agent:streamFrame),
 *      server `stream:frame { deviceId, imageBase64 }`'ni shu room'ga emit
 *   4. Hookni o'chirilganda `stream:unsubscribe` emit — oxirgi obunachi
 *      bo'lsa agent stream'ni to'xtatadi
 *
 * Afzalliklari (HTTP polling'ga nisbatan):
 *   - Push asosida (server kadr kelganda darhol uzatadi, polling'sayoz)
 *   - Bitta socket har bir brauzer uchun (HTTP requests/sec yo'q)
 *   - Bir nechta admin bir kameraga qarasa — bitta agent stream, hammaga tarqaladi
 *   - Latency ~5-10ms (HTTP polling 50-100ms'ga qarshi)
 */
export function useDeviceStream(
  deviceId: string | null | undefined,
  opts: { fps?: number; enabled?: boolean } = {},
): StreamState {
  const fps = Math.max(0.5, Math.min(10, opts.fps ?? 3));
  const enabled = opts.enabled ?? true;
  const token = useAuthStore((s) => s.token);

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId || !enabled || !token) {
      setIsInitialLoading(false);
      return;
    }

    let aborted = false;
    setIsInitialLoading(true);
    setError(null);

    const socket: Socket = io(NAMESPACE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onFrame = (payload: { deviceId: string; imageBase64: string }) => {
      if (aborted || payload.deviceId !== deviceId) return;
      // base64 → Blob → object URL. Avvalgi URL'ni revoke qilamiz.
      const bin = atob(payload.imageBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = url;
      setImgUrl(url);
      setLastFetchedAt(Date.now());
      setIsInitialLoading(false);
      setError(null);
    };

    socket.on('connect', () => {
      // Subscribe — server agentga startStream yuboradi
      socket.emit(
        'stream:subscribe',
        { deviceId, fps },
        (res: { ok: boolean; error?: string }) => {
          if (aborted) return;
          if (!res?.ok) {
            setError(res?.error ?? 'subscribe muvaffaqiyatsiz');
            setIsInitialLoading(false);
          }
        },
      );
    });

    socket.on('connect_error', (e) => {
      if (!aborted) {
        setError(e.message || 'socket ulanmadi');
        setIsInitialLoading(false);
      }
    });

    socket.on('stream:frame', onFrame);

    return () => {
      aborted = true;
      // Best effort — agentga server orqali stop yetkazamiz, keyin uzilamiz.
      if (socket.connected) {
        socket.emit('stream:unsubscribe', { deviceId });
      }
      socket.off('stream:frame', onFrame);
      socket.removeAllListeners();
      socket.disconnect();
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, [deviceId, fps, enabled, token]);

  return { imgUrl, lastFetchedAt, isInitialLoading, error };
}
