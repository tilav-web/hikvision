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
  PartyPopper,
  Plane,
  BarChart3,
  MessagesSquare,
  ScrollText,
} from 'lucide-react';

export interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: ('super_admin' | 'company_admin')[];
}

export const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  // Super admin (SaaS) tomoni
  { to: '/companies', icon: Building2, label: 'Kampaniyalar', roles: ['super_admin'] },
  { to: '/users', icon: Users, label: 'Foydalanuvchilar', roles: ['super_admin'] },
  // Operatsion (kampaniya ichki) — har ikkala rolga ko'rinadi, lekin scope farq qiladi
  { to: '/agents', icon: Cpu, label: 'Agentlar' },
  { to: '/devices', icon: ScanFace, label: 'Qurilmalar' },
  { to: '/persons', icon: IdCard, label: 'Hodimlar' },
  { to: '/attendance', icon: CalendarCheck, label: 'Davomat' },
  { to: '/statistics', icon: BarChart3, label: 'Statistika' },
  { to: '/events', icon: Activity, label: 'Hodisalar' },
  { to: '/audit-logs', icon: ScrollText, label: 'Audit jurnali' },
  { to: '/telegram-channels', icon: MessagesSquare, label: 'Telegram kanallar' },
  // Faqat company admin: kampaniya ichki ish jarayonlari
  { to: '/schedules', icon: CalendarClock, label: 'Jadval', roles: ['company_admin'] },
  { to: '/holidays', icon: PartyPopper, label: 'Bayramlar', roles: ['company_admin'] },
  { to: '/vacations', icon: Plane, label: "Ta'til", roles: ['company_admin'] },
  { to: '/payroll', icon: Coins, label: 'Mukofot/Jarima', roles: ['company_admin'] },
];
