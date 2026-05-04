import {
  Building2,
  Users,
  ScanFace,
  IdCard,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';

export function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isSuper
            ? 'Barcha kampaniyalar bo\'yicha umumiy ma\'lumot'
            : 'Kampaniyangiz bo\'yicha bugungi holat'
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isSuper && (
          <StatCard
            label="Faol kampaniyalar"
            value="—"
            hint="To'lov qilgan"
            icon={<Building2 className="h-5 w-5" />}
          />
        )}
        <StatCard
          label="Hodimlar"
          value="—"
          hint="Faol foydalanuvchilar"
          icon={<IdCard className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Qurilmalar"
          value="—"
          hint="Online"
          icon={<ScanFace className="h-5 w-5" />}
        />
        <StatCard
          label="Bugungi hodisalar"
          value="—"
          hint="Kirish/chiqish"
          icon={<Activity className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Davomat statistikasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-sm text-(--color-muted-foreground)">
              Grafik tez orada qo'shiladi
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              So'nggi hodisalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-sm text-(--color-muted-foreground)">
              Hozircha bo'sh
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
