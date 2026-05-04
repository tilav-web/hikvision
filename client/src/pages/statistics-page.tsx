import { useMemo, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Trophy,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  useAttendanceStats,
  usePerDayStats,
  usePerPersonStats,
} from '@/api/attendance';

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

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
}

function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}s ${m}d`;
}

export function StatisticsPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());

  const { data: stats } = useAttendanceStats({ from, to });
  const { data: perPerson } = usePerPersonStats({ from, to });
  const { data: perDay } = usePerDayStats({ from, to });

  const top5Late = useMemo(
    () => (perPerson ?? []).slice(0, 5),
    [perPerson],
  );

  const top5Workers = useMemo(() => {
    return [...(perPerson ?? [])]
      .sort((a, b) => b.totalWorkedMinutes - a.totalWorkedMinutes)
      .slice(0, 5);
  }, [perPerson]);

  // Trend chart uchun maxLate
  const maxLate = useMemo(() => {
    return Math.max(1, ...(perDay ?? []).map((d) => d.totalLateMinutes));
  }, [perDay]);

  return (
    <div>
      <PageHeader
        title="Statistika"
        description="Davomat va kechikishlar bo'yicha tahlillar"
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="st-from">Boshlanish</Label>
            <Input
              id="st-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="st-to">Tugash</Label>
            <Input
              id="st-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Jami kunlar"
          value={stats?.total ?? '—'}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          label="Kelganlar"
          value={stats?.present ?? '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Kechikkanlar"
          value={stats?.late ?? '—'}
          hint={stats ? `${stats.totalLateMinutes} daq jami` : undefined}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Kelmaganlar"
          value={stats?.absent ?? '—'}
          icon={<TrendingDown className="h-5 w-5" />}
          tone="destructive"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Eng ko'p kechikkanlar (Top-5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top5Late.length === 0 ? (
              <p className="text-sm text-(--color-muted-foreground) py-4 text-center">
                Hech kim kechikmagan
              </p>
            ) : (
              top5Late.map((p, i) => (
                <div key={p.personId} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-secondary) text-xs font-semibold">
                    {i + 1}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`/uploads/faces/${p.personId}.jpg`} />
                    <AvatarFallback className="text-xs">
                      {initials(p.personName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.personName}
                    </div>
                    <div className="text-xs text-(--color-muted-foreground)">
                      {p.lateDays} kun kechikdi
                    </div>
                  </div>
                  <Badge variant="warning">{p.totalLateMinutes} daq</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Eng ko'p ishlagan (Top-5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {top5Workers.length === 0 ? (
              <p className="text-sm text-(--color-muted-foreground) py-4 text-center">
                Hozircha ma'lumot yo'q
              </p>
            ) : (
              top5Workers.map((p, i) => (
                <div key={p.personId} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-secondary) text-xs font-semibold">
                    {i + 1}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`/uploads/faces/${p.personId}.jpg`} />
                    <AvatarFallback className="text-xs">
                      {initials(p.personName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {p.personName}
                    </div>
                    <div className="text-xs text-(--color-muted-foreground)">
                      {p.presentDays} kun keldi
                    </div>
                  </div>
                  <Badge variant="success">
                    {formatHours(p.totalWorkedMinutes)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Kunlik kechikishlar trendi</CardTitle>
        </CardHeader>
        <CardContent>
          {(perDay ?? []).length === 0 ? (
            <p className="text-sm text-(--color-muted-foreground) py-8 text-center">
              Ma'lumot yo'q
            </p>
          ) : (
            <div className="space-y-2">
              {(perDay ?? []).map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-mono text-(--color-muted-foreground)">
                    {new Date(d.date).toLocaleDateString('uz-UZ', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="flex-1 h-6 bg-(--color-secondary) rounded overflow-hidden">
                    <div
                      className="h-full bg-amber-500/70 transition-all"
                      style={{
                        width: `${Math.max(2, (d.totalLateMinutes / maxLate) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="w-24 text-xs text-right">
                    <span className="font-mono">{d.totalLateMinutes} daq</span>
                    <span className="text-(--color-muted-foreground) ml-2">
                      ({d.late}/{d.total})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hodimlar bo'yicha to'liq jadval</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hodim</TableHead>
                <TableHead className="text-center">Keldi</TableHead>
                <TableHead className="text-center">Kechikdi</TableHead>
                <TableHead className="text-center">Kelmadi</TableHead>
                <TableHead className="text-center">Ta'til</TableHead>
                <TableHead className="text-right">Kechikish (daq)</TableHead>
                <TableHead className="text-right">Ishlagan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(perPerson ?? []).length === 0 ? (
                <TableEmpty colSpan={7} />
              ) : (
                (perPerson ?? []).map((p) => (
                  <TableRow key={p.personId}>
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={`/uploads/faces/${p.personId}.jpg`} />
                          <AvatarFallback className="text-[10px]">
                            {initials(p.personName)}
                          </AvatarFallback>
                        </Avatar>
                        {p.personName}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-emerald-600 dark:text-emerald-400">
                      {p.presentDays}
                    </TableCell>
                    <TableCell className="text-center text-amber-600 dark:text-amber-400">
                      {p.lateDays}
                    </TableCell>
                    <TableCell className="text-center text-red-600 dark:text-red-400">
                      {p.absentDays}
                    </TableCell>
                    <TableCell className="text-center text-(--color-muted-foreground)">
                      {p.leaveDays}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {p.totalLateMinutes}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatHours(p.totalWorkedMinutes)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
