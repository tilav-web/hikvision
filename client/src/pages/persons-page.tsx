import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Search, IdCard } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PersonForm } from '@/components/person-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreatePerson,
  useDeletePerson,
  usePersons,
  useSyncPerson,
  useUpdatePerson,
} from '@/api/persons';
import { useDevices } from '@/api/devices';
import { useCompanies } from '@/api/companies';
import type { Person } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] ?? '') + (p[1]?.[0] ?? '');
}

export function PersonsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const [q, setQ] = useState('');
  const { data, isLoading } = usePersons({ q });
  const { data: companies } = useCompanies();
  const { data: devices } = useDevices();
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const remove = useDeletePerson();
  const sync = useSyncPerson();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);

  const onSubmit = (dto: any, file?: File) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            toast.success('Hodim yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(
        { dto, file },
        {
          onSuccess: () => {
            toast.success('Hodim qo\'shildi');
            setFormOpen(false);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    }
  };

  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Hodim o\'chirildi');
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  const onSync = (id: string) => {
    sync.mutate(id, {
      onSuccess: (res) => {
        if (res.failed.length === 0) {
          toast.success(`${res.success.length} ta qurilmaga sinxronlandi`);
        } else {
          toast.warning(
            `${res.success.length} OK, ${res.failed.length} xato`,
          );
        }
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Hodimlar"
        description="Yuz, karta, PIN — kirish ruxsatlari"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Yangi hodim
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-muted-foreground)" />
          <Input
            placeholder="Ism, tabel raqami yoki telefon..."
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hodim</TableHead>
              <TableHead>Tabel</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Sinxronlash</TableHead>
              <TableHead className="w-[140px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={5} message="Yuklanmoqda..." />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={5} />
            ) : (
              items.map((p) => {
                const synced = (p.deviceLinks ?? []).filter((l) => l.status === 'synced').length;
                const total = p.deviceLinks?.length ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={`/uploads/faces/${p.id}.jpg`} alt={p.name} />
                          <AvatarFallback>{initials(p.name) || <IdCard className="h-4 w-4" />}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.email && (
                            <div className="text-xs text-(--color-muted-foreground)">
                              {p.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.employeeNo}</TableCell>
                    <TableCell className="text-sm">{p.phone ?? '—'}</TableCell>
                    <TableCell>
                      {total === 0 ? (
                        <span className="text-xs text-(--color-muted-foreground)">
                          biriktirilmagan
                        </span>
                      ) : synced === total ? (
                        <Badge variant="success">{synced}/{total}</Badge>
                      ) : (
                        <Badge variant="warning">{synced}/{total}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Qurilmalarga sinxronlash"
                          onClick={() => onSync(p.id)}
                        >
                          <RefreshCw />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <PersonForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        companies={companies ?? []}
        devices={devices ?? []}
        isSuper={isSuper}
        loading={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Hodimni o'chirish?"
        description={`"${deleting?.name}" qurilmalardan ham o'chiriladi.`}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}
