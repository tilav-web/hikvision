import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { UnknownPersonListener } from '../unknown-person-listener';

export function AppShell() {
  return (
    <div className="flex min-h-dvh w-full bg-(--color-background)">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {/* Global real-time noma'lum shaxs eshituvchi — toast'lar va tezkor "qo'shish" */}
      <UnknownPersonListener />
    </div>
  );
}
