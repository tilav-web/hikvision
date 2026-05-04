import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Cpu, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
} from '@/api/agents';
import { useCompanies } from '@/api/companies';
import type { Agent } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('uz-UZ');
}

function AgentFormDialog({
  open,
  onOpenChange,
  initial,
  companies,
  isSuper,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Agent | null;
  companies: Array<{ id: string; name: string }>;
  isSuper: boolean;
  loading: boolean;
  onSubmit: (dto: { name: string; companyId?: string; hostInfo?: string }) => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [hostInfo, setHostInfo] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCompanyId(initial?.companyId ?? '');
      setHostInfo(initial?.hostInfo ?? '');
    }
  }, [open, initial]);

  const handle = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      companyId: !isEdit && isSuper ? companyId || undefined : undefined,
      hostInfo: hostInfo.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Agentni tahrirlash' : 'Yangi agent'}
          </DialogTitle>
          <DialogDescription>
            Agent — Windows yoki RPI4 da ishlaydigan dastur. Mijoz qurilmasida{' '}
            <code className="font-mono">.env</code> faylga shu nomni{' '}
            <code className="font-mono">AGENT_NAME</code> sifatida joylashtiradi.
            Kampaniya tokeni esa <strong>Kampaniyalar</strong> sahifasidan olinadi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-name">Agent nomi (AGENT_NAME)</Label>
            <Input
              id="a-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bosh ofis - RPI4"
            />
          </div>
          {!isEdit && isSuper && (
            <div className="space-y-2">
              <Label htmlFor="a-company">Kampaniya</Label>
              <Select
                id="a-company"
                required
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">Tanlang...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="a-host">Host info (ixtiyoriy)</Label>
            <Input
              id="a-host"
              value={hostInfo}
              onChange={(e) => setHostInfo(e.target.value)}
              placeholder="Windows 11 - 192.168.1.50"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AgentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const { data, isLoading } = useAgents();
  const { data: companies } = useCompanies();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const remove = useDeleteAgent();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    (companies ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [companies]);

  const onSubmit = (dto: { name: string; companyId?: string; hostInfo?: string }) => {
    if (editing) {
      update.mutate(
        { id: editing.id, dto: { name: dto.name, hostInfo: dto.hostInfo } },
        {
          onSuccess: () => {
            toast.success('Agent yangilandi');
            setFormOpen(false);
            setEditing(null);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
    } else {
      create.mutate(dto, {
        onSuccess: () => {
          toast.success('Agent yaratildi');
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
        toast.success('Agent o\'chirildi');
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Agentlar"
        description="Mahalliy bridge agentlar (Windows/RPI4) — kampaniya tokeni bilan ulanadi"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Yangi agent
          </Button>
        }
      />

      <div className="mb-4 rounded-md border border-(--color-border) bg-(--color-secondary)/30 p-3 text-sm text-(--color-muted-foreground)">
        💡 Agent qurilmasidagi <code className="font-mono">.env</code> ga 2 ta qiymat:
        <code className="font-mono mx-1">COMPANY_TOKEN</code>
        (Kampaniyalar sahifasidan) +
        <code className="font-mono mx-1">AGENT_NAME</code>
        (bu yerda yaratgan agent nomi).
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi (AGENT_NAME)</TableHead>
              {isSuper && <TableHead>Kampaniya</TableHead>}
              <TableHead>Holat</TableHead>
              <TableHead>So'nggi ulanish</TableHead>
              <TableHead className="w-[100px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={isSuper ? 5 : 4} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={isSuper ? 5 : 4} />
            ) : (
              (data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      <Cpu className="h-4 w-4 text-(--color-muted-foreground)" />
                      {a.name}
                    </div>
                    {a.hostInfo && (
                      <div className="text-xs text-(--color-muted-foreground) ml-6">
                        {a.hostInfo}
                      </div>
                    )}
                  </TableCell>
                  {isSuper && (
                    <TableCell className="text-sm">
                      {a.companyId ? companyMap.get(a.companyId) ?? '—' : '—'}
                    </TableCell>
                  )}
                  <TableCell>
                    {a.isOnline ? (
                      <Badge variant="success">Online</Badge>
                    ) : (
                      <Badge variant="secondary">Offline</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-(--color-muted-foreground)">
                    {formatDate(a.lastSeenAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleting(a)}
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

      <AgentFormDialog
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
        title="Agentni o'chirish?"
        description={`"${deleting?.name}" agentiga biriktirilgan qurilmalar agent bog'lanmagan holatga o'tadi. Agar shu nom bilan agent qaytadan ulansa, yangi yozuv yaratiladi.`}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}
