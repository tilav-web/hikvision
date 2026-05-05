import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  LogIn,
  LogOut,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAttendance,
  useAttendanceDayEvents,
  useAttendanceStats,
} from '@/api/attendance';
import type { AttendanceStatus } from '@/api/types';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

function fmtTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

function fmtMinutes(m: number): string {
  if (!m) return '0d';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}s ${mm}d`;
  if (h > 0) return `${h}s`;
  return `${mm}d`;
}

const STATUS_BADGE: Record<AttendanceStatus, { variant: any; label: string }> = {
  present: { variant: 'success', label: 'Keldi' },
  late: { variant: 'warning', label: 'Kechikdi' },
  absent: { variant: 'destructive', label: 'Kelmadi' },
  partial: { variant: 'outline', label: 'Yarim kun' },
  leave: { variant: 'secondary', label: "Ta'til" },
  holiday: { variant: 'default', label: 'Bayram' },
  currently_inside: { variant: 'success', label: 'Ichkarida' },
  overtime: { variant: 'success', label: 'Overtime' },
};

function AttendanceTimeline({ attendanceId }: { attendanceId: string }) {
  const { data, isLoading } = useAttendanceDayEvents(attendanceId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-(--color-muted-foreground)">
        <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
      </div>
    );
  }
  if (!data) return null;

  const { attendance: a, events } = data;

  return (
    <div className="bg-(--color-secondary)/20 px-4 py-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Kirish soni" value={a.enterCount} />
        <MiniStat label="Chiqish soni" value={a.exitCount} />
        <MiniStat
          label="Erta keldi"
          value={a.earlyArrivalMinutes ? `${fmtMinutes(a.earlyArrivalMinutes)}` : '—'}
        />
        <MiniStat
          label="Erta ketdi"
          value={
            a.earlyLeaveMinutes ? `${fmtMinutes(a.earlyLeaveMinutes)}` : '—'
          }
          tone={a.earlyLeaveMinutes > 0 ? 'warning' : undefined}
        />
        <MiniStat
          label="Kechikish"
          value={a.lateMinutes ? fmtMinutes(a.lateMinutes) : '—'}
          tone={a.lateMinutes > 0 ? 'warning' : undefined}
        />
        <MiniStat
          label="Tushlikdan ortiq"
          value={a.lunchOverstayMinutes ? fmtMinutes(a.lunchOverstayMinutes) : '—'}
          tone={a.lunchOverstayMinutes > 0 ? 'warning' : undefined}
        />
        <MiniStat
          label="Overtime"
          value={a.overtimeMinutes ? fmtMinutes(a.overtimeMinutes) : '—'}
          tone={a.overtimeMinutes > 0 ? 'success' : undefined}
        />
        <MiniStat label="Ishlangan" value={fmtMinutes(a.workedMinutes)} />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wide text-(--color-muted-foreground) mb-2">
          Kunlik timeline ({events.length} hodisa)
        </div>
        {events.length === 0 ? (
          <div className="text-sm text-(--color-muted-foreground)">
            Hech qanday hodisa yo'q.
          </div>
        ) : (
          <ol className="relative border-l-2 border-(--color-border) ml-2 space-y-3">
            {events.map((e) => (
              <li key={e.id} className="ml-4">
                <span
                  className={`absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-(--color-background) ${
                    e.direction === 'in' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs text-(--color-muted-foreground)">
                    {fmtTime(e.capturedAt)}
                  </span>
                  {e.direction === 'in' ? (
                    <Badge variant="success" className="gap-1">
                      <LogIn className="h-3 w-3" /> Kirdi
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <LogOut className="h-3 w-3" /> Chiqdi
                    </Badge>
                  )}
                  <span className="text-xs text-(--color-muted-foreground)">
                    {e.deviceName} · {e.verifyMode}
                    {e.directionSource && ` · ${e.directionSource}`}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'warning' | 'success';
}) {
  const color =
    tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'success'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-(--color-foreground)';
  return (
    <div className="rounded-md border border-(--color-border) bg-(--color-card) p-3">
      <div className="text-xs text-(--color-muted-foreground)">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export function AttendancePage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: stats } = useAttendanceStats({ from, to });
  const { data, isLoading } = useAttendance({ from, to });

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Davomat"
        description="Kunlik kirish/chiqish va kechikish hisoboti — qatorni bosing detallar uchun"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Jami kunlar"
          value={stats?.total ?? '—'}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          label="Kelganlar"
          value={stats?.present ?? '—'}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Kechikkanlar"
          value={stats?.late ?? '—'}
          hint={stats ? `${stats.totalLateMinutes} daq jami` : undefined}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Kelmaganlar"
          value={stats?.absent ?? '—'}
          icon={<ArrowUpCircle className="h-5 w-5" />}
          tone="destructive"
        />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="att-from">Boshlanish</Label>
            <Input
              id="att-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="att-to">Tugash</Label>
            <Input
              id="att-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Sana</TableHead>
              <TableHead>Hodim</TableHead>
              <TableHead className="text-center">Kirish/Chiqish</TableHead>
              <TableHead>Kirgan</TableHead>
              <TableHead>Chiqgan</TableHead>
              <TableHead>Kechikish</TableHead>
              <TableHead>Ishlagan</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={11} message="Yuklanmoqda..." />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={11} />
            ) : (
              items.flatMap((r) => {
                const sb = STATUS_BADGE[r.status];
                const expanded = expandedId === r.id;
                return [
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-(--color-secondary)/40"
                    onClick={() =>
                      setExpandedId(expanded ? null : r.id)
                    }
                  >
                    <TableCell>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-(--color-muted-foreground)" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-(--color-muted-foreground)" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.date}</TableCell>
                    <TableCell className="font-medium">
                      {r.person?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex gap-2 text-xs font-mono">
                        <span className="text-emerald-600">↓{r.enterCount}</span>
                        <span className="text-amber-600">↑{r.exitCount}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtTime(r.firstInAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtTime(r.lastOutAt)}
                    </TableCell>
                    <TableCell>
                      {r.lateMinutes > 0 ? (
                        <Badge variant="warning">{fmtMinutes(r.lateMinutes)}</Badge>
                      ) : (
                        <span className="text-sm text-(--color-muted-foreground)">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {fmtMinutes(r.workedMinutes)}
                    </TableCell>
                    <TableCell>
                      {r.overtimeMinutes > 0 ? (
                        <Badge variant="success">
                          {fmtMinutes(r.overtimeMinutes)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-(--color-muted-foreground)">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.personId && (
                        <Link
                          to={`/persons/${r.personId}`}
                          className="text-(--color-muted-foreground) hover:text-(--color-foreground)"
                          title="Hodim profili"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>,
                  expanded && (
                    <TableRow
                      key={`${r.id}-detail`}
                      className="bg-transparent hover:bg-transparent"
                    >
                      <TableCell colSpan={11} className="p-0">
                        <AttendanceTimeline attendanceId={r.id} />
                      </TableCell>
                    </TableRow>
                  ),
                ];
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
