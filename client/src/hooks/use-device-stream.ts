import { useEffect, useRef, useState } from 'react';
import {
  fetchStreamFrame,
  startDeviceStream,
  stopDeviceStream,
} from '@/api/devices';
import { getApiErrorMessage } from '@/lib/api';

interface StreamState {
  /** Hozirgi blob URL — birinchi muvaffaqiyatli kadrgacha null */
  imgUrl: string | null;
  /** Oxirgi muvaffaqiyatli olish vaqti (ms epoch) */
  lastFetchedAt: number | null;
  /** Birinchi kadrgacha true */
  isInitialLoading: boolean;
  /** Oxirgi muvaffaqiyatsiz so'rov xatosi */
  error: string | null;
}

/**
 * Kamera stream lifecycle hooki.
 *
 *  - `enabled=true` bo'lganda: agentga `startStream` yuboriladi (companyId guard
 *    server tomonida), keyin har 1000/fps ms da `frame` GET qilinadi.
 *  - `enabled` false bo'lsa yoki komponent unmount bo'lsa: `stopStream` yuboriladi.
 *  - Browser crash holatida ham agent o'zining 60s `lastTouch` timeoutiga ko'ra
 *    avtomatik to'xtaydi — orphaned session yo'q.
 *
 *  - fps o'zgartirilsa qaytadan `startStream` (idempotent — agent fps yangilaydi).
 *  - Memory: avvalgi blob URL har yangi kadrda revoke qilinadi.
 */
export function useDeviceStream(
  deviceId: string | null | undefined,
  opts: { fps?: number; enabled?: boolean } = {},
): StreamState {
  const fps = Math.max(0.5, Math.min(10, opts.fps ?? 3));
  const enabled = opts.enabled ?? true;

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId || !enabled) {
      setIsInitialLoading(false);
      return;
    }

    let aborted = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setIsInitialLoading(true);
    setError(null);

    // 1) Sessiyani boshlaymiz — agentga startStream yuboriladi.
    const startPromise = startDeviceStream(deviceId, fps).catch((e) => {
      if (!aborted) {
        setError(getApiErrorMessage(e));
        setIsInitialLoading(false);
      }
      throw e;
    });

    // 2) Polling — start javobini kutib turamiz, so'ng frame'larni so'raymiz.
    //    Birinchi bir necha kadr 404 bo'lishi mumkin (agent hali kadrga ulgurmagan)
    //    — bu normal, error sifatida ko'rsatamiz va davom etamiz.
    const fetchOne = async (): Promise<void> => {
      const startedAt = Date.now();
      try {
        const blob = await fetchStreamFrame(deviceId);
        if (aborted) return;
        const url = URL.createObjectURL(blob);
        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;
        setImgUrl(url);
        setLastFetchedAt(Date.now());
        setError(null);
      } catch (e) {
        if (!aborted) setError(getApiErrorMessage(e));
      } finally {
        if (!aborted) {
          setIsInitialLoading(false);
          const elapsed = Date.now() - startedAt;
          const wait = Math.max(50, Math.round(1000 / fps) - elapsed);
          timeoutId = setTimeout(fetchOne, wait);
        }
      }
    };

    startPromise
      .then(() => {
        if (!aborted) fetchOne();
      })
      .catch(() => {
        // start xato bo'ldi — polling boshlanmaydi.
      });

    // 3) Cleanup — abort + sessiyani yopish (best effort)
    return () => {
      aborted = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
      // Stop xato bo'lsa muammo emas — agent 60s'da o'zi to'xtaydi.
      stopDeviceStream(deviceId).catch(() => undefined);
    };
  }, [deviceId, fps, enabled]);

  return { imgUrl, lastFetchedAt, isInitialLoading, error };
}
