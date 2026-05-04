import { useState, type FormEvent } from 'react';
import { Plus, Trash2, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useCreateHoliday,
  useDeleteHoliday,
  useHolidays,
} from '@/api/holidays';
import type { Holiday } from '@/api/types';
import { getApiErrorMessage } from '@/lib/api';

export function HolidaysPage() {
  const { data, isLoading } = useHolidays();
  const create = useCreateHoliday();
  const remove = useDeleteHoliday();

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { date, name: name.trim() },
      {
        onSuccess: () => {
          toast.success('Bayram qo\'shildi');
          setOpen(false);
          setDate('');
          setName('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Bayram kunlari"
        description="Shu sanalarda hodimlar kelmasa ham 'kelmadi' deb belgilanmaydi va jarima yozilmaydi"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> Yangi bayram
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sana</TableHead>
              <TableHead>Bayram nomi</TableHead>
              <TableHead className="w-[60px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={3} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={3} />
            ) : (
              (data ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(h.date).toLocaleDateString('uz-UZ', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <PartyPopper className="h-4 w-4 text-amber-500" />
                      {h.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleting(h)}
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
            <DialogTitle>Yangi bayram</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="h-date">Sana</Label>
              <Input
                id="h-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-name">Bayram nomi</Label>
              <Input
                id="h-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mustaqillik kuni"
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
                Qo'shish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Bayramni o'chirish?"
        description={deleting?.name}
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
