import { useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ScanFace,
  Activity,
  RotateCw,
  DoorOpen,
} from 'lucide-react';
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
import { DeviceForm } from '@/components/device-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useCreateDevice,
  useDeleteDevice,
  useDevices,
  useOpenDoor,
  useRebootDevice,
  useTestDevice,
  useUpdateDevice,
} from '@/api/devices';
import { useAgents } from '@/api/agents';
import { useCompanies } from '@/api/companies';
import type { Device, DeviceMode } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

const MODE_LABEL: Record<DeviceMode, string> = {
  both: 'Kirish + Chiqish',
  entry: 'Kirish',
  exit: 'Chiqish',
};

const MODE_BADGE: Record<DeviceMode, 'default' | 'secondary' | 'success' | 'warning'> = {
  both: 'default',
  entry: 'success',
  exit: 'warning',
};

export function DevicesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const { data, isLoading } = useDevices();
  const { data: companies } = useCompanies();
  const { data: agents } = useAgents();
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const remove = useDeleteDevice();
  const test = useTestDevice();
  const reboot = useRebootDevice();
  const openDoor = useOpenDoor();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies]);

  const agentMap = useMemo(() => {
    const m = new Map<string, { name: string; isOnline: boolean }>();
    (agents ?? []).forEach((a) => m.set(a.id, { name: a.name, isOnline: a.isOnline }));
    return m;
  }, [agents]);

  const onSubmit = (dto: any) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto },
        {
          onSuccess: () => {
            toast.success('Qurilma yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(dto, {
        onSuccess: () => {
          toast.success('Qurilma qo\'shildi');
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
        toast.success('Qurilma o\'chirildi');
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  const onTest = (id: string) => {
    test.mutate(id, {
      onSuccess: (res) => {
        if (res.ok) toast.success('Qurilma ulanish OK');
        else toast.error(`Ulanmadi: ${res.error}`);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Qurilmalar"
        description="Hikvision FaceID terminallari"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Yangi qurilma
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Qurilma</TableHead>
              {isSuper && <TableHead>Kampaniya</TableHead>}
              <TableHead>Agent</TableHead>
              <TableHead>Rejim</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="w-[200px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} />
            ) : (
              (data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <ScanFace className="h-4 w-4 text-(--color-muted-foreground)" />
                      {d.name}
                    </div>
                    <div className="text-xs text-(--color-muted-foreground) ml-6 font-mono">
                      {d.useHttps ? 'https' : 'http'}://{d.host}:{d.port}
                    </div>
                  </TableCell>
                  {isSuper && (
                    <TableCell className="text-sm">
                      {d.companyId ? companyMap.get(d.companyId) ?? '—' : '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    {d.agentId ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {agentMap.get(d.agentId)?.name ?? '—'}
                        </span>
                        {agentMap.get(d.agentId)?.isOnline ? (
                          <Badge variant="success">on</Badge>
                        ) : (
                          <Badge variant="secondary">off</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-(--color-muted-foreground)">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={MODE_BADGE[d.mode]}>
                      {MODE_LABEL[d.mode]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.isOnline ? (
                      <Badge variant="success">Online</Badge>
                    ) : (
                      <Badge variant="secondary">Offline</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Ulanishni tekshirish"
                        onClick={() => onTest(d.id)}
                      >
                        <Activity />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Eshikni ochish"
                        onClick={() =>
                          openDoor.mutate(d.id, {
                            onSuccess: () => toast.success('Eshik ochildi'),
                            onError: (e) => toast.error(getApiErrorMessage(e)),
                          })
                        }
                      >
                        <DoorOpen />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Reboot"
                        onClick={() =>
                          reboot.mutate(d.id, {
                            onSuccess: () => toast.success('Reboot buyrug\'i yuborildi'),
                            onError: (e) => toast.error(getApiErrorMessage(e)),
                          })
                        }
                      >
                        <RotateCw />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(d);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(d)}
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

      <DeviceForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        initial={editing}
        companies={companies ?? []}
        agents={agents ?? []}
        isSuper={isSuper}
        loading={create.isPending || update.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Qurilmani o'chirish?"
        description={`"${deleting?.name}" qurilmasi va unga tegishli barcha hodisalar o'chiriladi.`}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}
