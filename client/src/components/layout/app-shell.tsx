import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { Topbar } from './topbar';
import { UnknownPersonListener } from '../unknown-person-listener';

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full bg-(--color-background)">
      <Sidebar />
      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      {/* Global real-time noma'lum shaxs eshituvchi — toast'lar va tezkor "qo'shish" */}
      <UnknownPersonListener />
    </div>
  );
}
