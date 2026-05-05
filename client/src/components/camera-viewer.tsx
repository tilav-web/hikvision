import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Pause,
  Play,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeviceSnapshot } from '@/hooks/use-device-snapshot';
import type { Device } from '@/api/types';

const FPS_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.5, label: '0.5 fps' },
  { value: 1, label: '1 fps' },
  { value: 2, label: '2 fps' },
  { value: 3, label: '3 fps' },
  { value: 5, label: '5 fps' },
];

/**
 * Kengaytirilgan kamera oynasi (modal). Yuqori fps polling, fullscreen,
 * pause/play, screenshot yuklab olish.
 *
 * Server endpoint: GET /api/hikvision/devices/:id/snapshot
 *   - Authorization: JWT (interceptor)
 *   - Throttle: 10 req/s (rate-limit)
 *   - Multi-tenant guard: server tomonida (company_admin → faqat o'z kampaniyasi)
 */
export function CameraViewer({
  device,
  open,
  onOpenChange,
}: Readonly<{
  device: Device | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}>) {
  const [fps, setFps] = useState(3);
  const [paused, setPaused] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const enabled = open && !paused && !!device;
  const { imgUrl, lastFetchedAt, isInitialLoading, error } = useDeviceSnapshot(
    device?.id ?? null,
    { fps, enabled },
  );

  // Modal yopilganda holatni reset
  useEffect(() => {
    if (!open) {
      setPaused(false);
      setIsFs(false);
    }
  }, [open]);

  const onScreenshot = () => {
    if (!imgUrl || !device) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `${device.name.replace(/\s+/g, '_')}_${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFs(true);
      } else {
        await document.exitFullscreen();
        setIsFs(false);
      }
    } catch {
      // foydalanuvchi rad qilgan bo'lishi mumkin — jim
    }
  };

  // Browser fullscreen tugagani aniqlash (Esc)
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  if (!device) return null;

  const isStale =
    lastFetchedAt !== null && Date.now() - lastFetchedAt > 5_000 && !paused;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-(--color-border)">
          <DialogTitle className="flex items-center gap-3">
            <Camera className="h-5 w-5" />
            <span>{device.name}</span>
            <Badge variant="outline" className="font-mono">
              {device.host}:{device.port}
            </Badge>
            {paused ? (
              <Badge variant="secondary">Pauza</Badge>
            ) : isStale ? (
              <Badge variant="warning">Stale</Badge>
            ) : imgUrl ? (
              <Badge variant="success">Live</Badge>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={containerRef}
          className="relative aspect-video w-full bg-black"
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={device.name}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : null}

          {!imgUrl && isInitialLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Kameraga ulanmoqda...</span>
            </div>
          )}

          {!imgUrl && !isInitialLoading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 px-4 text-center">
              <AlertCircle className="h-8 w-8" />
              <span className="text-sm font-medium">Ulanib bo'lmadi</span>
              <span className="text-xs text-white/50 max-w-md">{error}</span>
            </div>
          )}

          {/* Fullscreen rejimida boshqaruv overlay sifatida ko'rinadi */}
          {isFs && (
            <div className="absolute bottom-4 right-4 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="secondary" onClick={toggleFullscreen}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Boshqaruv panel */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-(--color-border) bg-(--color-card)">
          <div className="flex items-center gap-2">
            <span className="text-xs text-(--color-muted-foreground) uppercase tracking-wide">
              Kadr/sek
            </span>
            <div className="flex rounded-md border border-(--color-border) overflow-hidden">
              {FPS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFps(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    fps === opt.value
                      ? 'bg-(--color-primary) text-(--color-primary-foreground)'
                      : 'hover:bg-(--color-secondary)/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <>
                  <Play className="h-4 w-4" /> Davom ettirish
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" /> Pauza
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onScreenshot}
              disabled={!imgUrl}
            >
              <Download className="h-4 w-4" /> Saqlash
            </Button>
            <Button variant="outline" size="sm" onClick={toggleFullscreen}>
              <Maximize2 className="h-4 w-4" /> To'liq ekran
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
