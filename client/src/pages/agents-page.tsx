import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, KeyRound, Copy, Check, Cpu, Loader2 } from 'lucide-react';
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
  useRotateAgentToken,
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

function CopyToken({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(token);
          setCopied(true);
          toast.success('Token nusxalandi');
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error('Nusxalab bo\'lmadi');
        }
      }}
      title="Tokenni nusxalash"
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
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
            Agent — bu Windows yoki RPI4 da ishlaydigan dastur. Bitta agent bir
            nechta qurilmani boshqaradi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-name">Nomi</Label>
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
  const rotate = useRotateAgentToken();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [rotating, setRotating] = useState<Agent | null>(null);

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
          toast.success('Agent yaratildi — tokenni saqlab oling');
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

  const onRotate = () => {
    if (!rotating) return;
    rotate.mutate(rotating.id, {
      onSuccess: () => {
        toast.success('Yangi token generatsiya qilindi');
        setRotating(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Agentlar"
        description="Mahalliy bridge agentlar (Windows/RPI4)"
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nomi</TableHead>
              {isSuper && <TableHead>Kampaniya</TableHead>}
              <TableHead>Token</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>So'nggi ulanish</TableHead>
              <TableHead className="w-[160px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} />
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
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">
                        {a.token.slice(0, 8)}...{a.token.slice(-4)}
                      </span>
                      <CopyToken token={a.token} />
                    </div>
                  </TableCell>
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
                        title="Tokenni yangilash"
                        onClick={() => setRotating(a)}
                      >
                        <KeyRound />
                      </Button>
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
        description={`"${deleting?.name}" agentiga biriktirilgan qurilmalar agent bog'lanmagan holatga o'tadi.`}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />

      <ConfirmDialog
        open={!!rotating}
        onOpenChange={(o) => !o && setRotating(null)}
        title="Tokenni yangilash?"
        description="Eski token darhol bekor bo'ladi va agent qayta ulanmaydi. Yangi tokenni agentning .env fayliga kiritish kerak bo'ladi."
        confirmText="Ha, yangilash"
        loading={rotate.isPending}
        onConfirm={onRotate}
      />
    </div>
  );
}
