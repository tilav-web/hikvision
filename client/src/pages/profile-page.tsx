import { useState, type FormEvent } from 'react';
import { Loader2, User as UserIcon, Lock, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUpdateUser } from '@/api/users';
import { useCompany } from '@/api/companies';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uz-UZ');
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const update = useUpdateUser();
  const { data: company } = useCompany(user?.companyId);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const onProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    update.mutate(
      { id: user.id, dto: { fullName: fullName.trim() } },
      {
        onSuccess: (u) => {
          if (token) {
            setAuth(token, {
              id: u.id,
              email: u.email,
              fullName: u.fullName,
              role: u.role,
              companyId: u.companyId,
            });
          }
          toast.success('Profil yangilandi');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (password.length < 6) {
      toast.error('Parol kamida 6 ta belgidan iborat bo\'lishi kerak');
      return;
    }
    if (password !== confirm) {
      toast.error('Parollar mos kelmadi');
      return;
    }
    update.mutate(
      { id: user.id, dto: { password } },
      {
        onSuccess: () => {
          toast.success('Parol o\'zgartirildi');
          setPassword('');
          setConfirm('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Profil" description="O'z ma'lumotlaringiz va parol" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex flex-col items-center text-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-xl">
                {initials(user.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{user.fullName}</div>
              <div className="text-sm text-(--color-muted-foreground)">
                {user.email}
              </div>
            </div>
            <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'}>
              {user.role === 'super_admin' ? 'Super admin' : 'Kampaniya admin'}
            </Badge>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {company && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Kampaniya
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-(--color-muted-foreground)">
                      Nomi
                    </Label>
                    <div className="text-sm font-medium">{company.name}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-(--color-muted-foreground)">
                      Slug (super-admin tomonidan qo'yilgan, o'zgartirib bo'lmaydi)
                    </Label>
                    <div className="text-sm font-mono">{company.slug}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-(--color-muted-foreground)">
                      To'lov muddati
                    </Label>
                    <div className="text-sm">{formatDate(company.paidUntil)}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-(--color-muted-foreground)">
                      Holat
                    </Label>
                    <div>
                      {company.status === 'active' ? (
                        <Badge variant="success">Faol</Badge>
                      ) : (
                        <Badge variant="secondary">To'xtatilgan</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-(--color-muted-foreground) mt-4">
                  Kampaniya ma'lumotlarini o'zgartirish uchun super-admin bilan
                  bog'laning.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="h-4 w-4" />
                Shaxsiy ma'lumotlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pf-email">Email</Label>
                  <Input id="pf-email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-name">To'liq ism</Label>
                  <Input
                    id="pf-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  Saqlash
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                Parolni o'zgartirish
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pf-pass">Yangi parol</Label>
                  <Input
                    id="pf-pass"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-confirm">Yangi parolni tasdiqlang</Label>
                  <Input
                    id="pf-confirm"
                    type="password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Lock />
                  )}
                  Parolni yangilash
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
