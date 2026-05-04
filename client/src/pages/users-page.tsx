import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserForm } from '@/components/user-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from '@/api/users';
import { useCompanies } from '@/api/companies';
import type { User } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

export function UsersPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const { data: users, isLoading } = useUsers();
  const { data: companies } = useCompanies();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies]);

  const onSubmit = (dto: any) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            toast.success('Foydalanuvchi yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(dto, {
        onSuccess: () => {
          toast.success('Foydalanuvchi yaratildi');
          setFormOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      });
    }
  };

  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Foydalanuvchi o\'chirildi');
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar"
        description="Admin va kampaniya egalari"
        actions={
          isSuper && (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Yangi foydalanuvchi
            </Button>
          )
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Ism</TableHead>
              <TableHead>Rol</TableHead>
              {isSuper && <TableHead>Kampaniya</TableHead>}
              <TableHead>Holat</TableHead>
              <TableHead className="w-[120px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} message="Yuklanmoqda..." />
            ) : (users ?? []).length === 0 ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} />
            ) : (
              (users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'super_admin' ? 'default' : 'secondary'}>
                      {u.role === 'super_admin' ? 'Super admin' : 'Kampaniya admin'}
                    </Badge>
                  </TableCell>
                  {isSuper && (
                    <TableCell className="text-sm">
                      {u.companyId ? companyMap.get(u.companyId) ?? '—' : '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">Faol</Badge>
                    ) : (
                      <Badge variant="secondary">Bloklangan</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(u);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      {isSuper && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleting(u)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <UserForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        companies={companies ?? []}
        loading={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Foydalanuvchini o'chirish?"
        description={deleting?.email}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}
