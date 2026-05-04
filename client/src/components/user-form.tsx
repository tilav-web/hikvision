import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Company, User, UserRole } from '@/api/types';
import type { UserInput } from '@/api/users';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: User | null;
  companies: Company[];
  loading?: boolean;
  onSubmit: (dto: UserInput | { fullName?: string; password?: string; isActive?: boolean }) => void;
}

export function UserForm({
  open,
  onOpenChange,
  initial,
  companies,
  loading,
  onSubmit,
}: Props) {
  const isEdit = !!initial;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('company_admin');
  const [companyId, setCompanyId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      setEmail(initial?.email ?? '');
      setPassword('');
      setFullName(initial?.fullName ?? '');
      setRole(initial?.role ?? 'company_admin');
      setCompanyId(initial?.companyId ?? '');
      setIsActive(initial?.isActive ?? true);
    }
  }, [open, initial]);

  const handle = (e: FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      const patch: { fullName?: string; password?: string; isActive?: boolean } = {
        fullName: fullName.trim(),
        isActive,
      };
      if (password) patch.password = password;
      onSubmit(patch);
    } else {
      const dto: UserInput = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        companyId: role === 'super_admin' ? null : companyId || null,
        isActive,
      };
      onSubmit(dto);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              required
              disabled={isEdit}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-name">To'liq ism</Label>
            <Input
              id="u-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          {!isEdit && (
            <>
              <div className="space-y-2">
                <Label htmlFor="u-role">Rol</Label>
                <Select
                  id="u-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="company_admin">Kampaniya admini</option>
                  <option value="super_admin">Super admin</option>
                </Select>
              </div>
              {role === 'company_admin' && (
                <div className="space-y-2">
                  <Label htmlFor="u-company">Kampaniya</Label>
                  <Select
                    id="u-company"
                    required
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                  >
                    <option value="">Tanlang...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="u-pass">
              {isEdit ? 'Yangi parol (bo\'sh — o\'zgarmaydi)' : 'Parol'}
            </Label>
            <Input
              id="u-pass"
              type="password"
              required={!isEdit}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="u-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-(--color-border)"
            />
            <Label htmlFor="u-active" className="cursor-pointer">
              Faol
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
