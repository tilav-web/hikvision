import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  Cpu,
  IdCard,
  CalendarClock,
  Activity,
  ScanFace,
  Coins,
  CalendarCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: ('super_admin' | 'company_admin')[];
}

const items: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/companies', icon: Building2, label: 'Kampaniyalar', roles: ['super_admin'] },
  { to: '/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/agents', icon: Cpu, label: 'Agentlar' },
  { to: '/devices', icon: ScanFace, label: 'Qurilmalar' },
  { to: '/persons', icon: IdCard, label: 'Hodimlar' },
  { to: '/schedules', icon: CalendarClock, label: 'Jadval' },
  { to: '/attendance', icon: CalendarCheck, label: 'Davomat' },
  { to: '/events', icon: Activity, label: 'Hodisalar' },
  { to: '/payroll', icon: Coins, label: 'Mukofot/Jarima' },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role);

  const visible = items.filter((it) => !it.roles || (role && it.roles.includes(role)));

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-(--color-border) bg-(--color-card)">
      <div className="flex h-14 items-center gap-2 px-5 border-b border-(--color-border)">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary) text-(--color-primary-foreground)">
          <ScanFace className="h-4 w-4" />
        </div>
        <div className="font-semibold">Hikvision</div>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {visible.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-(--color-secondary) text-(--color-secondary-foreground)'
                  : 'text-(--color-muted-foreground) hover:bg-(--color-secondary)/50 hover:text-(--color-foreground)',
              )
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-(--color-border)">
        <div className="text-xs text-(--color-muted-foreground)">v0.1.0</div>
      </div>
    </aside>
  );
}
