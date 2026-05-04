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
import { CompanyForm } from '@/components/company-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCompanies,
  useCreateCompany,
  useDeleteCompany,
  useUpdateCompany,
} from '@/api/companies';
import type { Company } from '@/api/types';
import { getApiErrorMessage } from '@/lib/api';

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uz-UZ');
}

function isExpired(paidUntil: string | null): boolean {
  if (!paidUntil) return false;
  return new Date(paidUntil) < new Date();
}

export function CompaniesPage() {
  const { data, isLoading } = useCompanies();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const remove = useDeleteCompany();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const companies = useMemo(() => data ?? [], [data]);

  const onSubmit = (dto: Parameters<typeof create.mutate>[0]) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            toast.success('Kampaniya yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(dto, {
        onSuccess: () => {
          toast.success('Kampaniya yaratildi');
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
        toast.success('Kampaniya o\'chirildi');
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Kampaniyalar"
        description="SaaS mijozlari, to'lov holati va limitlar"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Yangi kampaniya
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>To'lov muddati</TableHead>
              <TableHead className="text-center">Limitlar</TableHead>
              <TableHead className="w-[120px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={6} message="Yuklanmoqda..." />
            ) : companies.length === 0 ? (
              <TableEmpty colSpan={6} />
            ) : (
              companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>
                    <Badge
                      variant={c.status === 'active' ? 'success' : 'secondary'}
                    >
                      {c.status === 'active' ? 'Faol' : 'To\'xtatilgan'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatDate(c.paidUntil)}</span>
                      {isExpired(c.paidUntil) && (
                        <Badge variant="warning">Muddati o'tgan</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-(--color-muted-foreground)">
                    {c.maxDevices} qur. / {c.maxEmployees} hod.
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(c);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <CompanyForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        loading={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Kampaniyani o'chirish?"
        description={`"${deleting?.name}" va unga tegishli barcha ma'lumotlar (qurilmalar, hodimlar, hodisalar) o'chiriladi. Bu amalni qaytarib bo'lmaydi.`}
        destructive
        loading={remove.isPending}
        confirmText="Ha, o'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}
