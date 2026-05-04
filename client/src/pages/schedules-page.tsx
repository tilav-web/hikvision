import { useState } from 'react';
import { Plus, Pencil, Trash2, CalendarClock } from 'lucide-react';
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
import { ScheduleForm } from '@/components/schedule-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useSchedules,
  useUpdateSchedule,
} from '@/api/schedules';
import { useCompanies } from '@/api/companies';
import type { Schedule } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

const DAY_LABELS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function formatDays(bitmask: number): string {
  return DAY_LABELS.filter((_, i) => bitmask & (1 << i)).join(', ');
}

export function SchedulesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const { data, isLoading } = useSchedules();
  const { data: companies } = useCompanies();
  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const remove = useDeleteSchedule();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const onSubmit = (dto: any) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            toast.success('Jadval yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(dto, {
        onSuccess: () => {
          toast.success('Jadval yaratildi');
          setFormOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Ish jadvali"
        description="Ish vaqti, kechikish chegarasi, avtomatik jarima"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Yangi jadval
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              <TableHead>Vaqt</TableHead>
              <TableHead>Ish kunlari</TableHead>
              <TableHead>Kechikish</TableHead>
              <TableHead>1 daq jarima</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="w-[100px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={7} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={7} />
            ) : (
              (data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <CalendarClock className="h-4 w-4 text-(--color-muted-foreground)" />
                      {s.name}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.startTime} – {s.endTime}
                  </TableCell>
                  <TableCell className="text-sm text-(--color-muted-foreground)">
                    {formatDays(s.workingDays)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.graceMinutes} daq grace, {s.lateThresholdMinutes} daq jarima
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {Number(s.penaltyPerLateMinute).toLocaleString('uz-UZ')} so'm
                  </TableCell>
                  <TableCell>
                    {s.isActive ? (
                      <Badge variant="success">Faol</Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(s)}
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

      <ScheduleForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        companies={companies ?? []}
        isSuper={isSuper}
        loading={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Jadvalni o'chirish?"
        description={`"${deleting?.name}" — bu jadvalga biriktirilgan hodimlarning scheduleId null bo'ladi.`}
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
