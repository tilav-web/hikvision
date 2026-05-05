import { useEffect, useRef, useState } from 'react';
import { fetchDeviceSnapshot } from '@/api/devices';
import { getApiErrorMessage } from '@/lib/api';

interface SnapshotState {
  /** Hozirgi blob URL — `<img src>` ga berish uchun. Birinchi muvaffaqiyatli yuklanishgacha null. */
  imgUrl: string | null;
  /** Oxirgi muvaffaqiyatli olish vaqti (ms epoch) */
  lastFetchedAt: number | null;
  /** Birinchi yuklash davomida true */
  isInitialLoading: boolean;
  /** Oxirgi yuklash xato bilan tugadimi */
  error: string | null;
}

/**
 * Hikvision qurilmadan jonli JPEG snapshot polling qiladi (server-proxied).
 *
 *  - `fps`: kadrlar/soniya (1..10). Snapshot kutilgandan keyin yana polling
 *    chaqirilmaydi — qurilma sekin javob bersa interval yana sekinlashadi.
 *  - `enabled=false` bo'lsa polling to'xtaydi va resurs ozod etiladi.
 *  - Xato bo'lsa keyingi muvaffaqiyatgacha oxirgi rasm o'rnida qoladi
 *    (UI "stale" badge'ini ko'rsatishi mumkin).
 *
 * Resurs boshqaruvi: avvalgi blob URL har yangi kadrda revoke qilinadi,
 * komponent unmount bo'lganda ham. Memory leak yo'q.
 */
export function useDeviceSnapshot(
  deviceId: string | null | undefined,
  opts: { fps?: number; enabled?: boolean; channel?: number } = {},
): SnapshotState {
  const fps = Math.max(0.5, Math.min(10, opts.fps ?? 1));
  const enabled = opts.enabled ?? true;
  const channel = opts.channel ?? 1;

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Eski URL'ni revoke qilish uchun ref'da saqlaymiz (state'da yozsak race bo'ladi).
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deviceId || !enabled) {
      setIsInitialLoading(false);
      return;
    }

    let aborted = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    setIsInitialLoading(true);

    const fetchOne = async (): Promise<void> => {
      const startedAt = Date.now();
      try {
        const blob = await fetchDeviceSnapshot(deviceId, channel);
        if (aborted) return;
        const url = URL.createObjectURL(blob);
        // Eski URL'ni revoke
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
          // Polling: minimal interval = 1000/fps. Lekin so'rov uzoq davom etgan
          // bo'lsa darhol yana boshlaymiz (interval > duration bo'lsa kutamiz).
          const elapsed = Date.now() - startedAt;
          const wait = Math.max(0, Math.round(1000 / fps) - elapsed);
          timeoutId = setTimeout(fetchOne, wait);
        }
      }
    };

    fetchOne();

    return () => {
      aborted = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (lastUrlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = null;
      }
    };
  }, [deviceId, fps, enabled, channel]);

  return { imgUrl, lastFetchedAt, isInitialLoading, error };
}
