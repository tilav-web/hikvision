import { Sun, Moon, Monitor, LogOut, User as UserIcon, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-(--color-border) bg-(--color-background)/80 px-4 sm:px-6 backdrop-blur">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Menyu"
          onClick={onMenuClick}
        >
          <Menu />
        </Button>
        <div className="truncate text-sm text-(--color-muted-foreground)">
          Xush kelibsiz, <span className="text-(--color-foreground) font-medium">{user?.fullName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Theme">
              {themeMode === 'dark' ? (
                <Moon />
              ) : themeMode === 'light' ? (
                <Sun />
              ) : (
                <Monitor />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setMode('light')}>
              <Sun /> Yorug'
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode('dark')}>
              <Moon /> Qorong'i
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMode('system')}>
              <Monitor /> Tizim
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {initials(user?.fullName ?? 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-xs font-medium">{user?.fullName}</span>
                <span className="text-[10px] text-(--color-muted-foreground)">
                  {user?.email}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{user?.fullName}</span>
              <span className="text-xs font-normal text-(--color-muted-foreground)">
                {user?.email}
              </span>
              {user?.role && (
                <Badge variant="outline" className="w-fit mt-1">
                  {user.role === 'super_admin' ? 'Super admin' : 'Kampaniya admini'}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <UserIcon /> Profil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut /> Chiqish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
