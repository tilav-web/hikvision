import { useMemo, useState } from 'react';
import { Calendar, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react';
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
import { useAttendance, useAttendanceStats } from '@/api/attendance';
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

const STATUS_BADGE: Record<AttendanceStatus, { variant: any; label: string }> = {
  present: { variant: 'success', label: 'Keldi' },
  late: { variant: 'warning', label: 'Kechikdi' },
  absent: { variant: 'destructive', label: 'Kelmadi' },
  partial: { variant: 'outline', label: 'Yarim kun' },
  leave: { variant: 'secondary', label: "Ta'til" },
  holiday: { variant: 'default', label: 'Bayram' },
};

export function AttendancePage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());

  const { data: stats } = useAttendanceStats({ from, to });
  const { data, isLoading } = useAttendance({ from, to });

  const items = useMemo(() => data?.items ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Davomat"
        description="Kunlik kirish/chiqish va kechikish hisoboti"
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
              <TableHead>Sana</TableHead>
              <TableHead>Hodim</TableHead>
              <TableHead>Kirgan</TableHead>
              <TableHead>Chiqgan</TableHead>
              <TableHead>Kechikish</TableHead>
              <TableHead>Ishlagan</TableHead>
              <TableHead>Holat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={7} message="Yuklanmoqda..." />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={7} />
            ) : (
              items.map((r) => {
                const sb = STATUS_BADGE[r.status];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.date}</TableCell>
                    <TableCell className="font-medium">
                      {r.person?.name ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtTime(r.firstInAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtTime(r.lastOutAt)}
                    </TableCell>
                    <TableCell>
                      {r.lateMinutes > 0 ? (
                        <Badge variant="warning">{r.lateMinutes} daq</Badge>
                      ) : (
                        <span className="text-sm text-(--color-muted-foreground)">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {Math.floor(r.workedMinutes / 60)}s {r.workedMinutes % 60}d
                    </TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
