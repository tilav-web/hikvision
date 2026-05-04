import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Check, KeyRound, Eye, EyeOff } from 'lucide-react';
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
  useRotateCompanyToken,
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

function TokenCell({ token }: { token: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      toast.success('Token nusxalandi');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Nusxalab bo\'lmadi');
    }
  };

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs select-all max-w-[160px] truncate">
        {revealed ? token : `${token.slice(0, 6)}••••${token.slice(-4)}`}
      </span>
      <Button
        size="icon"
        variant="ghost"
        title={revealed ? 'Yashirish' : 'Ko\'rsatish'}
        onClick={() => setRevealed((v) => !v)}
      >
        {revealed ? <EyeOff /> : <Eye />}
      </Button>
      <Button size="icon" variant="ghost" onClick={onCopy} title="Nusxalash">
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

export function CompaniesPage() {
  const { data, isLoading } = useCompanies();
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const remove = useDeleteCompany();
  const rotate = useRotateCompanyToken();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [rotating, setRotating] = useState<Company | null>(null);

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
          toast.success('Kampaniya yaratildi — token ko\'rinadi, mijozga yuboring');
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

  const onRotate = () => {
    if (!rotating) return;
    rotate.mutate(rotating.id, {
      onSuccess: () => {
        toast.success('Yangi token generatsiya qilindi — agentlarda yangilang');
        setRotating(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Kampaniyalar"
        description="SaaS mijozlari, to'lov holati va API tokenlar"
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
              <TableHead>API token (mijoz agentlariga)</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>To'lov muddati</TableHead>
              <TableHead className="text-center">Limitlar</TableHead>
              <TableHead className="w-[140px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={7} message="Yuklanmoqda..." />
            ) : companies.length === 0 ? (
              <TableEmpty colSpan={7} />
            ) : (
              companies.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>
                    <TokenCell token={c.apiToken} />
                  </TableCell>
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
                        title="Tokenni yangilash"
                        onClick={() => setRotating(c)}
                      >
                        <KeyRound />
                      </Button>
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

      <ConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title="API tokenni yangilash?"
        description={`"${rotating?.name}" kampaniyasining barcha agentlari darhol uziladi. Yangi tokenni mijozga yuborib, .env faylda yangilash kerak bo'ladi.`}
        confirmText="Ha, yangilash"
        loading={rotate.isPending}
        onConfirm={onRotate}
      />
    </div>
  );
}
