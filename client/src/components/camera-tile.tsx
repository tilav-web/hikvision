import { Camera, Loader2, Maximize2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDeviceSnapshot } from '@/hooks/use-device-snapshot';
import type { Device } from '@/api/types';

/**
 * Kameralar grid'idagi bitta plitka. Past fps bilan polling qiladi (default 1)
 * — bir vaqtda 20 kameraga qaragan bo'lsangiz ham ohirgi LAN'ni yuklamaydi.
 *
 * Bosish — kattaroq oynani (`CameraViewer`) ochadi.
 */
export function CameraTile({
  device,
  active,
  onOpen,
  fps = 1,
}: Readonly<{
  device: Device;
  /** Plitka aktiv polling qilsinmi (modal ochilsa false qilinadi). */
  active: boolean;
  onOpen: () => void;
  fps?: number;
}>) {
  const { imgUrl, lastFetchedAt, isInitialLoading, error } = useDeviceSnapshot(
    device.id,
    { fps, enabled: active },
  );

  const isStale =
    lastFetchedAt !== null && Date.now() - lastFetchedAt > 5_000;

  return (
    <button
      onClick={onOpen}
      className="group relative aspect-video w-full overflow-hidden rounded-lg border border-(--color-border) bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
    >
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={device.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {!imgUrl && isInitialLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 text-xs">
          <Loader2 className="h-6 w-6 animate-spin" />
          Ulanmoqda...
        </div>
      )}

      {!imgUrl && !isInitialLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50 text-xs px-3 text-center">
          <AlertCircle className="h-6 w-6" />
          {error || 'Kadr olinmadi'}
        </div>
      )}

      {/* Top overlay: nom + holat */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex flex-col text-left text-white drop-shadow min-w-0">
          <div className="text-sm font-medium truncate">{device.name}</div>
          <div className="text-[11px] text-white/70 font-mono truncate">
            {device.host}
          </div>
        </div>
        {error && imgUrl && (
          <Badge variant="warning" className="shrink-0">
            Stale
          </Badge>
        )}
        {!error && isStale && imgUrl && (
          <Badge variant="warning" className="shrink-0">
            Stale
          </Badge>
        )}
      </div>

      {/* Bottom overlay: hover'da kengaytirish */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-[11px] text-white/80 inline-flex items-center gap-1">
          <Camera className="h-3 w-3" /> {fps} fps
        </span>
        <span className="text-xs text-white inline-flex items-center gap-1">
          Kengaytirish <Maximize2 className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}
