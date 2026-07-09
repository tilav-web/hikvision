import {
  Building2,
  ScanFace,
  IdCard,
  Activity,
  TrendingUp,
  AlertCircle,
  Wifi,
  WifiOff,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth-store';
import { useCompanies } from '@/api/companies';
import { useDevices } from '@/api/devices';
import { usePersons } from '@/api/persons';
import { useEvents } from '@/api/events';
import { useAttendanceStats } from '@/api/attendance';
import { useEventsSocket } from '@/hooks/use-events-socket';
import type { AccessEvent } from '@/api/types';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const { data: companies } = useCompanies();
  const { data: devices } = useDevices();
  const { data: personsData } = usePersons({ take: 1 }); // faqat total kerak
  const today = todayStr();
  const { data: stats } = useAttendanceStats({ from: today, to: today });
  const { data: eventsData } = useEvents({ take: 8 });

  const [liveCount, setLiveCount] = useState(0);
  const { connected } = useEventsSocket(() => setLiveCount((c) => c + 1));

  const activeCompanies = (companies ?? []).filter((c) => c.status === 'active').length;
  const onlineDevices = (devices ?? []).filter((d) => d.isOnline).length;
  const totalPersons = personsData?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isSuper
            ? 'Barcha kampaniyalar bo\'yicha umumiy ma\'lumot'
            : 'Bugungi holat'
        }
        actions={
          connected ? (
            <Badge variant="success" className="gap-1">
              <Wifi className="h-3 w-3" />
              Jonli {liveCount > 0 && `(${liveCount} yangi)`}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <WifiOff className="h-3 w-3" />
              Uzilgan
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isSuper && (
          <StatCard
            label="Faol kampaniyalar"
            value={activeCompanies}
            hint={`${companies?.length ?? 0} jami`}
            icon={<Building2 className="h-5 w-5" />}
          />
        )}
        <StatCard
          label="Hodimlar"
          value={totalPersons}
          icon={<IdCard className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Qurilmalar"
          value={`${onlineDevices}/${devices?.length ?? 0}`}
          hint="online/jami"
          icon={<ScanFace className="h-5 w-5" />}
        />
        <StatCard
          label="Bugun keldi"
          value={stats?.present ?? '—'}
          hint={stats ? `${stats.late} kechikkan` : undefined}
          icon={<Activity className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Bugungi davomat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <div className="h-40 flex items-center justify-center text-sm text-(--color-muted-foreground)">
                Yuklanmoqda...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-(--color-border) p-3">
                  <div className="text-xs text-(--color-muted-foreground)">Keldi</div>
                  <div className="text-2xl font-semibold text-emerald-500">
                    {stats.present}
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border) p-3">
                  <div className="text-xs text-(--color-muted-foreground)">Kechikdi</div>
                  <div className="text-2xl font-semibold text-amber-500">
                    {stats.late}
                  </div>
                  <div className="text-xs text-(--color-muted-foreground) mt-1">
                    {stats.totalLateMinutes} daq
                  </div>
                </div>
                <div className="rounded-lg border border-(--color-border) p-3">
                  <div className="text-xs text-(--color-muted-foreground)">Yarim kun</div>
                  <div className="text-2xl font-semibold">{stats.partial}</div>
                </div>
                <div className="rounded-lg border border-(--color-border) p-3">
                  <div className="text-xs text-(--color-muted-foreground)">Kelmadi</div>
                  <div className="text-2xl font-semibold text-red-500">
                    {stats.absent}
                  </div>
                </div>
              </div>
            )}

            {stats && stats.late > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-4 w-4" />
                Bugun {stats.late} hodim kechikdi — jami {stats.totalLateMinutes} daqiqa
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              So'nggi hodisalar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(eventsData?.items ?? []).length === 0 ? (
              <p className="text-sm text-(--color-muted-foreground) py-8 text-center">
                Hozircha hodisa yo'q
              </p>
            ) : (
              (eventsData?.items ?? []).slice(0, 6).map((e: AccessEvent) => (
                <div key={e.id} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {e.personId && (
                      <AvatarImage src={`/uploads/faces/${e.personId}.jpg`} />
                    )}
                    <AvatarFallback className="text-xs">
                      {(e.personName ?? '?').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {e.personName ?? 'Noma\'lum'}
                    </div>
                    <div className="text-xs text-(--color-muted-foreground)">
                      {new Date(e.capturedAt).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  {e.direction === 'in' ? (
                    <ArrowRight className="h-4 w-4 text-emerald-500" />
                  ) : e.direction === 'out' ? (
                    <ArrowLeft className="h-4 w-4 text-amber-500" />
                  ) : (
                    <span className="text-xs text-(--color-muted-foreground)">—</span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
