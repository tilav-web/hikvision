import { useMemo, useState } from 'react';
import { Video, VideoOff, Grid2x2, Grid3x3, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDevices } from '@/api/devices';
import {
  useMultiDeviceStream,
  type CameraCellState,
} from '@/hooks/use-multi-device-stream';

const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
};

function CameraCell({
  name,
  location,
  state,
}: {
  name: string;
  location: string | null;
  state: CameraCellState | undefined;
}) {
  const s = state;
  const stale =
    s?.lastFetchedAt != null && Date.now() - s.lastFetchedAt > 8000;

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-(--color-border) bg-black">
      {s?.imgUrl ? (
        <img src={s.imgUrl} alt={name} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-(--color-muted-foreground)">
          {s?.error ? (
            <>
              <VideoOff className="h-6 w-6" />
              <span className="px-3 text-center text-xs">{s.error}</span>
            </>
          ) : (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs">Ulanmoqda...</span>
            </>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <span className="truncate text-sm font-medium text-white">
          {name}
          {location && (
            <span className="ml-1 text-xs text-white/60">· {location}</span>
          )}
        </span>
        {s?.imgUrl && (
          <Badge variant={stale ? 'warning' : 'success'} className="shrink-0">
            {stale ? 'Sekin' : 'Jonli'}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CamerasPage() {
  const { data: devices, isLoading } = useDevices();
  const [cols, setCols] = useState(2);

  const streamable = useMemo(
    () => (devices ?? []).filter((d) => d.agentId),
    [devices],
  );
  const ids = useMemo(() => streamable.map((d) => d.id), [streamable]);
  const states = useMultiDeviceStream(ids, { fps: 2 });

  return (
    <div>
      <PageHeader
        title="Kameralar"
        description="Barcha kameralarni bir ekranda jonli kuzatish"
        actions={
          <div className="flex gap-1">
            <Button
              variant={cols === 2 ? 'default' : 'outline'}
              size="icon"
              onClick={() => setCols(2)}
              title="2 ustun"
            >
              <Grid2x2 />
            </Button>
            <Button
              variant={cols === 3 ? 'default' : 'outline'}
              size="icon"
              onClick={() => setCols(3)}
              title="3 ustun"
            >
              <Grid3x3 />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Card className="p-10 text-center text-(--color-muted-foreground)">
          Yuklanmoqda...
        </Card>
      ) : streamable.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center text-(--color-muted-foreground)">
          <Video className="h-8 w-8" />
          <div>
            Agent bilan bog'langan kamera yo'q. Qurilmalar sahifasida qurilmani
            agentga biriktiring.
          </div>
        </Card>
      ) : (
        <div className={cn('grid gap-3', COLS[cols])}>
          {streamable.map((d) => (
            <CameraCell
              key={d.id}
              name={d.name}
              location={d.location}
              state={states[d.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
