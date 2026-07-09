import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Plane } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  useCreateVacation,
  useDeleteVacation,
  useVacations,
} from '@/api/vacations';
import { usePersons } from '@/api/persons';
import type { Vacation, VacationType } from '@/api/types';
import { getApiErrorMessage } from '@/lib/api';

const TYPE_LABEL: Record<VacationType, string> = {
  vacation: 'Ta\'til',
  sick: 'Kasal',
  unpaid: 'Maoshsiz',
  business_trip: 'Xizmat safari',
  other: 'Boshqa',
};

const TYPE_VARIANT: Record<VacationType, any> = {
  vacation: 'success',
  sick: 'warning',
  unpaid: 'secondary',
  business_trip: 'default',
  other: 'outline',
};

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('uz-UZ');
}

export function VacationsPage() {
  const { data, isLoading } = useVacations();
  const { data: persons } = usePersons({ take: 1000 }); // picker — barcha hodimlar
  const create = useCreateVacation();
  const remove = useDeleteVacation();

  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState('');
  const [type, setType] = useState<VacationType>('vacation');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState<Vacation | null>(null);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        personId,
        type,
        fromDate,
        toDate,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Ta\'til qo\'shildi');
          setOpen(false);
          setPersonId('');
          setReason('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Ta'til boshqaruvi"
        description="Hodim ta'tilda yoki kasal bo'lsa, davomatda jarima yozilmaydi"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Yangi ta'til
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hodim</TableHead>
              <TableHead>Boshlanish</TableHead>
              <TableHead>Tugash</TableHead>
              <TableHead>Tur</TableHead>
              <TableHead>Sabab</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={6} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={6} />
            ) : (
              (data ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <Plane className="h-4 w-4 text-(--color-muted-foreground)" />
                      {v.person?.name ?? '—'}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {fmt(v.fromDate)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {fmt(v.toDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANT[v.type]}>
                      {TYPE_LABEL[v.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-(--color-muted-foreground)">
                    {v.reason ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleting(v)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi ta'til</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="v-person">Hodim</Label>
              <Select
                id="v-person"
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
            <div className="space-y-2">
              <Label htmlFor="v-type">Tur</Label>
              <Select
                id="v-type"
                value={type}
                onChange={(e) => setType(e.target.value as VacationType)}
              >
                <option value="vacation">Ta'til</option>
                <option value="sick">Kasal</option>
                <option value="unpaid">Maoshsiz</option>
                <option value="business_trip">Xizmat safari</option>
                <option value="other">Boshqa</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="v-from">Boshlanish</Label>
                <Input
                  id="v-from"
                  type="date"
                  required
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-to">Tugash</Label>
                <Input
                  id="v-to"
                  type="date"
                  required
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-reason">Sabab (ixtiyoriy)</Label>
              <Textarea
                id="v-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
        title="Ta'tilni o'chirish?"
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
