import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Filter,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
import { useCleanupEvents, useEvents } from '@/api/events';
import { useEventsSocket } from '@/hooks/use-events-socket';
import { getApiErrorMessage } from '@/lib/api';
import type { AccessEvent } from '@/api/types';

interface LiveEvent extends AccessEvent {
  deviceName?: string;
}

type CategoryFilter =
  | ''
  | 'accessGranted'
  | 'accessDenied'
  | 'doorOpen'
  | 'doorClose'
  | 'tamper'
  | 'duress';

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

const CATEGORY_LABELS: Record<string, string> = {
  accessGranted: 'Ruxsat',
  accessDenied: 'Rad etildi',
  doorOpen: 'Eshik ochildi',
  doorClose: 'Eshik yopildi',
  tamper: 'Buzg\'unchilik',
  duress: 'Majburlash',
  unknown: 'Noma\'lum',
};

export function EventsPage() {
  const [category, setCategory] = useState<CategoryFilter>('');
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [olderThanDays, setOlderThanDays] = useState(90);
  const [confirmCleanup, setConfirmCleanup] = useState<
    'all' | 'unknown' | null
  >(null);

  const { data, isLoading } = useEvents({
    take: 50,
    category: category || undefined,
    includeUnknown,
  });
  const cleanup = useCleanupEvents();

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  const { connected } = useEventsSocket((e) => {
    setLiveEvents((cur) => [e, ...cur].slice(0, 50));
  });

  useEffect(() => {
    if (data?.items) setLiveEvents(data.items as LiveEvent[]);
  }, [data]);

  // Live oqimda kategoriyaga to'g'ri kelmaydiganlarini filterlaymiz
  const visible = useMemo(() => {
    return liveEvents.filter((e) => {
      if (category && e.category !== category) return false;
      if (!includeUnknown && !category && e.category === 'unknown') return false;
      return true;
    });
  }, [liveEvents, category, includeUnknown]);

  const onCleanup = () => {
    cleanup.mutate(
      {
        olderThanDays,
        onlyUnknown: confirmCleanup === 'unknown',
      },
      {
        onSuccess: (res) => {
          toast.success(`${res.deleted} ta hodisa o'chirildi`);
          setConfirmCleanup(null);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Hodisalar"
        description="Real vaqtda kirish/chiqish oqimi · Filterlash va eskilarni tozalash"
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

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ev-cat" className="flex items-center gap-1 text-xs">
              <Filter className="h-3 w-3" />
              Kategoriya
            </Label>
            <Select
              id="ev-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="min-w-[180px]"
            >
              <option value="">Hammasi (noma'lumdan tashqari)</option>
              <option value="accessGranted">✓ Ruxsat berildi</option>
              <option value="accessDenied">✗ Rad etildi</option>
              <option value="doorOpen">🔓 Eshik ochildi</option>
              <option value="doorClose">🔒 Eshik yopildi</option>
              <option value="tamper">⚠️ Buzg'unchilik</option>
              <option value="duress">🚨 Majburlash</option>
            </Select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm pb-2">
            <input
              type="checkbox"
              checked={includeUnknown}
              onChange={(e) => setIncludeUnknown(e.target.checked)}
              className="h-4 w-4 rounded border-(--color-border)"
            />
            Noma'lumni ham ko'rsatish
          </label>

          <div className="flex-1" />

          <div className="space-y-1">
            <Label htmlFor="ev-days" className="text-xs">
              N kundan eski
            </Label>
            <Input
              id="ev-days"
              type="number"
              min={1}
              max={3650}
              value={olderThanDays}
              onChange={(e) =>
                setOlderThanDays(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
              className="w-24"
            />
          </div>

          <Button
            variant="outline"
            onClick={() => setConfirmCleanup('unknown')}
            disabled={cleanup.isPending}
          >
            <Trash2 className="h-4 w-4" /> Faqat noma'lumlarni tozalash
          </Button>
          <Button
            variant="destructive"
            onClick={() => setConfirmCleanup('all')}
            disabled={cleanup.isPending}
          >
            {cleanup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eskilarni o'chirish
          </Button>
        </div>
      </Card>

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
            {isLoading && visible.length === 0 ? (
              <TableEmpty colSpan={6} message="Yuklanmoqda..." />
            ) : visible.length === 0 ? (
              <TableEmpty
                colSpan={6}
                message={
                  category || !includeUnknown
                    ? "Filtrga mos hodisa yo'q"
                    : "Hozircha hodisa yo'q"
                }
              />
            ) : (
              visible.map((e) => (
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
                        {e.personName ?? "Noma'lum"}
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
                      <span>
                        {CATEGORY_LABELS[e.category] ?? e.category}
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
        {visible.length} ta hodisa ko'rsatilmoqda · oxirgi 50
        {!connected && ' (jonli oqim uzilgan, qayta ulanmoqda...)'}
      </p>

      <ConfirmDialog
        open={!!confirmCleanup}
        onOpenChange={(o) => !o && setConfirmCleanup(null)}
        title={
          confirmCleanup === 'unknown'
            ? "Noma'lum hodisalarni o'chirishni tasdiqlang"
            : "Eski hodisalarni o'chirishni tasdiqlang"
        }
        description={
          confirmCleanup === 'unknown'
            ? `${olderThanDays} kundan eski faqat 'noma'lum' kategoriyali hodisalar o'chiriladi. Bu amalni qaytarib bo'lmaydi.`
            : `${olderThanDays} kundan eski BARCHA hodisalar o'chiriladi (rasm fayllari ham). Bu amalni qaytarib bo'lmaydi.`
        }
        destructive
        loading={cleanup.isPending}
        confirmText="O'chirish"
        onConfirm={onCleanup}
      />
    </div>
  );
}
