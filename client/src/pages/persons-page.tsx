import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, RefreshCw, Search, IdCard, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
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
  useImportPersons,
  usePersons,
  useSyncPerson,
  useUpdatePerson,
  useUploadFace,
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

  const PAGE_SIZE = 20;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(0);

  // Har harfda emas, yozib bo'lgach so'rov (300ms debounce) — so'rov toshqinini oldini oladi.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  // Yangi qidiruvda 1-sahifaga qaytamiz.
  useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const { data, isLoading } = usePersons({
    q: debouncedQ,
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const { data: companies } = useCompanies();
  const { data: devices } = useDevices();
  const create = useCreatePerson();
  const update = useUpdatePerson();
  const uploadFace = useUploadFace();
  const remove = useDeletePerson();
  const sync = useSyncPerson();
  const importPersons = useImportPersons();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // bir xil faylni qayta tanlash mumkin bo'lsin
    if (!file) return;
    try {
      const res = await importPersons.mutateAsync({ file });
      if (res.skipped.length === 0) {
        toast.success(`${res.created.length} ta hodim import qilindi`);
      } else {
        toast.warning(
          `${res.created.length} qo'shildi, ${res.skipped.length} o'tkazildi (masalan: ${res.skipped[0]?.reason})`,
        );
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState<Person | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const onSubmit = async (dto: any, file?: File) => {
    if (editing) {
      try {
        await update.mutateAsync({ id: editing.id, dto });
        if (file) {
          await uploadFace.mutateAsync({ id: editing.id, file });
        }
        // Tahrir natijasini qurilmalarga yuboramiz (yuz, ism, karta o'zgargan bo'lishi mumkin)
        const res = await sync.mutateAsync(editing.id);
        if (res.failed.length === 0) {
          toast.success(
            `Hodim yangilandi va ${res.success.length} ta qurilmaga sinxronlandi`,
          );
        } else {
          toast.warning(
            `Yangilandi · ${res.success.length} OK, ${res.failed.length} xato`,
          );
        }
        setFormOpen(false);
        setEditing(null);
      } catch (e) {
        toast.error(getApiErrorMessage(e));
      }
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
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={onImportFile}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={importPersons.isPending}
              title="Excel (.xlsx): Ism, Tabel, Karta, PIN, Telefon, Lavozim, Maosh"
            >
              <Upload />
              {importPersons.isPending ? 'Import...' : 'Excel import'}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus /> Yangi hodim
            </Button>
          </div>
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
                          {p.faceImagePath && (
                            <AvatarImage src={`/uploads/faces/${p.id}.jpg`} alt={p.name} />
                          )}
                          <AvatarFallback>{initials(p.name) || <IdCard className="h-4 w-4" />}</AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            to={`/persons/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
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

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-(--color-border) px-4 py-3">
            <span className="text-sm text-(--color-muted-foreground)">
              {rangeStart}–{rangeEnd} / {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Oldingi
              </Button>
              <span className="text-sm tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Keyingi <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
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
