import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Coffee,
  Loader2,
  IdCard,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
import { usePerson } from '@/api/persons';
import { usePersonStats } from '@/api/attendance';
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
  return new Date(d).toLocaleTimeString('uz-UZ', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtMinutes(m: number): string {
  if (!m) return '0d';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0 && mm > 0) return `${h}s ${mm}d`;
  if (h > 0) return `${h}s`;
  return `${mm}d`;
}

function fmtMoney(n: number): string {
  return `${n.toLocaleString('uz-UZ')} so'm`;
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
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

export function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const personId = id ?? null;

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());

  const { data: person, isLoading: personLoading } = usePerson(personId);
  const { data: stats, isLoading: statsLoading } = usePersonStats(personId, {
    from,
    to,
  });

  const facePath = useMemo(() => {
    if (!person?.faceImagePath) return null;
    return `/uploads/faces/${person.id}.jpg`;
  }, [person]);

  if (personLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-(--color-muted-foreground)">
        <Loader2 className="h-5 w-5 animate-spin" /> Yuklanmoqda...
      </div>
    );
  }
  if (!person) {
    return (
      <div className="p-8">
        <p>Hodim topilmadi.</p>
        <Link to="/persons">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4" /> Hodimlar
          </Button>
        </Link>
      </div>
    );
  }

  const genderLabel =
    person.gender === 'male'
      ? 'Erkak'
      : person.gender === 'female'
        ? 'Ayol'
        : null;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/persons"
          className="inline-flex items-center gap-1 text-sm text-(--color-muted-foreground) hover:text-(--color-foreground)"
        >
          <ArrowLeft className="h-4 w-4" /> Hodimlar
        </Link>
      </div>

      {/* Hero: katta rasm + asosiy ma'lumotlar */}
      <Card className="overflow-hidden mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr]">
          <div className="relative bg-gradient-to-br from-(--color-secondary)/40 to-(--color-secondary)/10 aspect-[3/4] md:aspect-auto md:min-h-[360px]">
            {facePath ? (
              <img
                src={facePath}
                alt={person.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-(--color-muted-foreground)">
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-(--color-secondary)/60 text-4xl font-semibold">
                  {initials(person.name) || (
                    <IdCard className="h-12 w-12" />
                  )}
                </div>
                <span className="text-xs">Yuz rasmi yuklanmagan</span>
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-(--color-muted-foreground)">
                Hodim
              </div>
              <h1 className="text-2xl font-bold leading-tight mt-1">
                {person.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono">
                  #{person.employeeNo}
                </Badge>
                {genderLabel && (
                  <Badge variant="secondary">{genderLabel}</Badge>
                )}
                {person.position && (
                  <Badge variant="outline">{person.position}</Badge>
                )}
              </div>
            </div>

            <div className="border-t border-(--color-border) -mx-6" />

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <ProfileField
                icon={<Phone className="h-4 w-4" />}
                label="Telefon"
                value={person.phone}
              />
              <ProfileField
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value={person.email}
              />
              <ProfileField
                icon={<CreditCard className="h-4 w-4" />}
                label="Karta"
                value={person.cardNo}
                mono
              />
              <ProfileField
                icon={<Calendar className="h-4 w-4" />}
                label="Yaratilgan"
                value={
                  person.createdAt
                    ? new Date(person.createdAt).toLocaleDateString('uz-UZ')
                    : null
                }
              />
            </dl>
          </div>
        </div>
      </Card>

      {/* Sana filter */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ps-from">Boshlanish</Label>
            <Input
              id="ps-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ps-to">Tugash</Label>
            <Input
              id="ps-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFrom(firstOfMonth());
              setTo(todayStr());
            }}
          >
            Joriy oy
          </Button>
        </div>
      </Card>

      {statsLoading || !stats ? (
        <div className="flex items-center gap-2 py-8 text-(--color-muted-foreground)">
          <Loader2 className="h-5 w-5 animate-spin" /> Statistika yuklanmoqda...
        </div>
      ) : (
        <>
          {/* Asosiy ko'rsatkichlar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="Jami kunlar"
              value={stats.counts.total}
              icon={<Calendar className="h-5 w-5" />}
            />
            <StatCard
              label="Ishladi"
              value={fmtMinutes(stats.minutes.worked)}
              icon={<Clock className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Kechikish"
              value={fmtMinutes(stats.minutes.late)}
              hint={`${stats.counts.late} kun`}
              icon={<AlertCircle className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Kelmadi"
              value={stats.counts.absent}
              icon={<TrendingDown className="h-5 w-5" />}
              tone="destructive"
            />
          </div>

          {/* Kengaytirilgan ko'rsatkichlar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <StatCard
              label="Erta keldi"
              value={fmtMinutes(stats.minutes.earlyArrival)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="success"
            />
            <StatCard
              label="Erta ketdi"
              value={fmtMinutes(stats.minutes.earlyLeave)}
              icon={<TrendingDown className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Tushlikdan ortiq"
              value={fmtMinutes(stats.minutes.lunchOverstay)}
              icon={<Coffee className="h-5 w-5" />}
              tone="warning"
            />
            <StatCard
              label="Overtime"
              value={fmtMinutes(stats.minutes.overtime)}
              icon={<Clock className="h-5 w-5" />}
              tone="success"
            />
          </div>

          {/* Pul */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <StatCard
              label="Bayram"
              value={stats.counts.holiday}
              icon={<Calendar className="h-5 w-5" />}
            />
            <StatCard
              label="Jarima jami"
              value={fmtMoney(stats.money.totalPenalty)}
              tone={stats.money.totalPenalty > 0 ? 'destructive' : undefined}
              icon={<TrendingDown className="h-5 w-5" />}
            />
            <StatCard
              label="Bonus jami"
              value={fmtMoney(stats.money.totalBonus)}
              tone={stats.money.totalBonus > 0 ? 'success' : undefined}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </div>

          {/* Kunlar jadvali */}
          <Card>
            <div className="px-4 py-3 border-b border-(--color-border) text-sm text-(--color-muted-foreground)">
              Kunlar bo'yicha tafsilot ({stats.range.from} → {stats.range.to})
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead className="text-center">In/Out</TableHead>
                  <TableHead>Kirgan</TableHead>
                  <TableHead>Chiqgan</TableHead>
                  <TableHead>Kechikish</TableHead>
                  <TableHead>Ishladi</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Holat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.rows.length === 0 ? (
                  <TableEmpty colSpan={8} message="Bu davrda yozuv yo'q" />
                ) : (
                  stats.rows.map((r) => {
                    const sb = STATUS_BADGE[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {r.date}
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
                            <Badge variant="warning">
                              {fmtMinutes(r.lateMinutes)}
                            </Badge>
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
  mono,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}>) {
  const empty = !value;
  let valueClass = 'font-medium';
  if (empty) valueClass = 'text-(--color-muted-foreground)';
  else if (mono) valueClass = 'font-mono text-sm';
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-(--color-muted-foreground) shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-(--color-muted-foreground) uppercase tracking-wide">
          {label}
        </dt>
        <dd
          className={`mt-0.5 truncate ${valueClass}`}
          title={value ?? undefined}
        >
          {value || '—'}
        </dd>
      </div>
    </div>
  );
}
