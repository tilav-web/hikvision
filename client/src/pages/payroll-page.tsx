import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatCard } from '@/components/stat-card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreatePenalty,
  useDeletePenalty,
  usePenalties,
} from '@/api/penalties';
import { usePersons } from '@/api/persons';
import type { Penalty, PenaltyKind, PenaltyType } from '@/api/types';
import { getApiErrorMessage } from '@/lib/api';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

const KIND_LABEL: Record<PenaltyKind, string> = {
  late: 'Kechikish',
  early_leave: 'Erta ketish',
  absent: 'Kelmaganlik',
  manual: 'Qo\'lda',
  early_arrival: 'Erta kelish',
};

function fmt(amount: string): string {
  return Number(amount).toLocaleString('uz-UZ') + ' so\'m';
}

export function PayrollPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Penalty | null>(null);

  const { data, isLoading } = usePenalties({ from, to });
  const { data: persons } = usePersons();
  const create = useCreatePenalty();
  const remove = useDeletePenalty();

  // Form state
  const [personId, setPersonId] = useState('');
  const [type, setType] = useState<PenaltyType>('penalty');
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const items = useMemo(() => data?.items ?? [], [data]);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        personId,
        type,
        date,
        amount,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Yozuv qo\'shildi');
          setCreateOpen(false);
          setPersonId('');
          setAmount('');
          setReason('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Mukofot va Jarima"
        description="Avtomatik kechikish hisobi + qo'lda jarima/mukofot"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> Qo'lda yozuv
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Jami jarima"
          value={data ? fmt(String(data.totalPenalty)) : '—'}
          icon={<TrendingDown className="h-5 w-5" />}
          tone="destructive"
        />
        <StatCard
          label="Jami mukofot"
          value={data ? fmt(String(data.totalBonus)) : '—'}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Sof natija"
          value={data ? fmt(String(data.net)) : '—'}
          hint="mukofot − jarima"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="pf-from">Boshlanish</Label>
            <Input
              id="pf-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-to">Tugash</Label>
            <Input
              id="pf-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-44"
            />
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana</TableHead>
              <TableHead>Hodim</TableHead>
              <TableHead>Tur</TableHead>
              <TableHead>Sabab</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={6} message="Yuklanmoqda..." />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={6} />
            ) : (
              items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.date}</TableCell>
                  <TableCell className="font-medium">{p.person?.name ?? '—'}</TableCell>
                  <TableCell>
                    {p.type === 'penalty' ? (
                      <Badge variant="destructive">Jarima</Badge>
                    ) : (
                      <Badge variant="success">Mukofot</Badge>
                    )}
                    <span className="ml-2 text-xs text-(--color-muted-foreground)">
                      {KIND_LABEL[p.kind]}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-(--color-muted-foreground)">
                    {p.reason ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmt(p.amount)}
                  </TableCell>
                  <TableCell>
                    {p.kind === 'manual' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qo'lda jarima/mukofot</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pe-person">Hodim</Label>
              <Select
                id="pe-person"
                required
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Tanlang...</option>
                {(persons?.items ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.employeeNo})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pe-type">Tur</Label>
                <Select
                  id="pe-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as PenaltyType)}
                >
                  <option value="penalty">Jarima</option>
                  <option value="bonus">Mukofot</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-date">Sana</Label>
                <Input
                  id="pe-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-amount">Summa (so'm)</Label>
              <Input
                id="pe-amount"
                type="number"
                min={0}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-reason">Sabab</Label>
              <Textarea
                id="pe-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" disabled={create.isPending}>
                Saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Yozuvni o'chirish?"
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('O\'chirildi');
              setDeleting(null);
            },
            onError: (e) => toast.error(getApiErrorMessage(e)),
          });
        }}
      />
    </div>
  );
}
