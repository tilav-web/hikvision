import { NavLink } from 'react-router-dom';
import { ScanFace, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { navItems } from './nav-items';

/**
 * Mobil navigatsiya — md'dan kichik ekranlarda hamburger orqali ochiladigan
 * chap-drawer. Sidebar bilan bir xil `navItems`dan foydalanadi.
 */
export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const visible = navItems.filter(
    (it) => !it.roles || (role && it.roles.includes(role)),
  );

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 md:hidden',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <aside
        className={cn(
          'absolute left-0 top-0 h-full w-64 flex flex-col border-r border-(--color-border) bg-(--color-card) shadow-xl transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-5 border-b border-(--color-border)">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary) text-(--color-primary-foreground)">
              <ScanFace className="h-4 w-4" />
            </div>
            <div className="font-semibold">Hikvision</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="text-(--color-muted-foreground) hover:text-(--color-foreground)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visible.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              onClick={onClose}
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
      </aside>
    </div>
  );
}
