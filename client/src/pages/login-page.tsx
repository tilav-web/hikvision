import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ScanFace, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useLogin } from '@/hooks/use-login';
import { getApiErrorMessage } from '@/lib/api';

export function LoginPage() {
  const token = useAuthStore((s) => s.token);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (token) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email: email.trim(), password });
  };

  return (
    <div className="min-h-dvh w-full bg-gradient-to-br from-[hsl(240_5%_98%)] to-[hsl(240_8%_94%)] dark:from-[hsl(240_10%_4%)] dark:to-[hsl(240_8%_8%)] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--color-primary) text-(--color-primary-foreground)">
            <ScanFace className="h-6 w-6" />
          </div>
          <div className="text-2xl font-semibold tracking-tight">Hikvision</div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Tizimga kirish</CardTitle>
            <CardDescription>
              Hodimlarni boshqarish paneli
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {login.isError && (
                <div className="rounded-md border border-(--color-destructive)/30 bg-(--color-destructive)/10 px-3 py-2 text-sm text-(--color-destructive)">
                  {getApiErrorMessage(login.error)}
                </div>
              )}
              <Button type="submit" disabled={login.isPending} className="w-full">
                {login.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Kutilmoqda...
                  </>
                ) : (
                  'Kirish'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-(--color-muted-foreground)">
          Hikvision FaceID Management System
        </p>
      </div>
    </div>
  );
}
