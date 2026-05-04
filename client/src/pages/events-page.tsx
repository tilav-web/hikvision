import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEvents } from '@/api/events';
import { useEventsSocket } from '@/hooks/use-events-socket';
import type { AccessEvent } from '@/api/types';

interface LiveEvent extends AccessEvent {
  deviceName?: string;
}

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s oldin`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}d oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s oldin`;
  return new Date(d).toLocaleString('uz-UZ');
}

function DirectionBadge({ d }: { d: AccessEvent['direction'] }) {
  if (d === 'in')
    return (
      <Badge variant="success" className="gap-1">
        <ArrowRight className="h-3 w-3" />
        Kirish
      </Badge>
    );
  if (d === 'out')
    return (
      <Badge variant="warning" className="gap-1">
        <ArrowLeft className="h-3 w-3" />
        Chiqish
      </Badge>
    );
  return <Badge variant="outline">—</Badge>;
}

function CategoryIcon({ c }: { c: AccessEvent['category'] }) {
  if (c === 'accessGranted')
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (c === 'accessDenied')
    return <XCircle className="h-4 w-4 text-red-500" />;
  return <Activity className="h-4 w-4 text-(--color-muted-foreground)" />;
}

export function EventsPage() {
  const { data, isLoading } = useEvents({ take: 50 });
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const { connected } = useEventsSocket((e) => {
    setLiveEvents((cur) => [e, ...cur].slice(0, 50));
  });

  useEffect(() => {
    if (data?.items) setLiveEvents(data.items as LiveEvent[]);
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Hodisalar"
        description="Real vaqtda kirish/chiqish oqimi"
        actions={
          connected ? (
            <Badge variant="success" className="gap-1">
              <Wifi className="h-3 w-3" />
              Jonli
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="h-3 w-3" />
              Uzilgan
            </Badge>
          )
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vaqt</TableHead>
              <TableHead>Hodim</TableHead>
              <TableHead>Tabel</TableHead>
              <TableHead>Yo'nalish</TableHead>
              <TableHead>Qurilma</TableHead>
              <TableHead>Holat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && liveEvents.length === 0 ? (
              <TableEmpty colSpan={6} message="Yuklanmoqda..." />
            ) : liveEvents.length === 0 ? (
              <TableEmpty colSpan={6} message="Hozircha hodisa yo'q" />
            ) : (
              liveEvents.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-(--color-muted-foreground) whitespace-nowrap">
                    {timeAgo(e.capturedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        {e.personId && (
                          <AvatarImage
                            src={`/uploads/faces/${e.personId}.jpg`}
                            alt={e.personName ?? ''}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {(e.personName ?? '?').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {e.personName ?? 'Noma\'lum'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.employeeNo ?? '—'}
                  </TableCell>
                  <TableCell>
                    <DirectionBadge d={e.direction} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.deviceName ?? e.deviceId.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <CategoryIcon c={e.category} />
                      <span className="capitalize">
                        {e.category === 'accessGranted'
                          ? 'Ruxsat'
                          : e.category === 'accessDenied'
                          ? 'Rad'
                          : e.category}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-(--color-muted-foreground) mt-3">
        {liveEvents.length} ta hodisa ko'rsatilmoqda · oxirgi 50
        {!connected && ' (jonli oqim uzilgan, qayta ulanmoqda...)'}
      </p>
    </div>
  );
}
