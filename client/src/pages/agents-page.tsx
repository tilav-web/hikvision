import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Cpu,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Radar,
  PlusCircle,
} from 'lucide-react';
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
  useAgentDiscovered,
  useAgentInspect,
  useAgents,
  useCreateAgent,
  useDeleteAgent,
  useUpdateAgent,
  type DiscoveredDeviceDto,
} from '@/api/agents';
import { useCreateDevice } from '@/api/devices';
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

function AddDiscoveredDialog({
  agentId,
  device,
  onOpenChange,
  onCreated,
}: {
  agentId: string;
  device: DiscoveredDeviceDto | null;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const create = useCreateDevice();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'entry' | 'exit' | 'both'>('both');

  useEffect(() => {
    if (device) {
      setName(device.deviceDescription || device.deviceType || `Qurilma ${device.serialNumber.slice(-6)}`);
      setUsername('admin');
      setPassword('');
      setMode('both');
    }
  }, [device]);

  if (!device) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        name: name.trim(),
        agentId,
        host: device.ipv4Address,
        port: device.httpPort,
        useHttps: false,
        username: username.trim(),
        password,
        mode,
      },
      {
        onSuccess: () => {
          toast.success('Qurilma qo\'shildi');
          onCreated();
          onOpenChange(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={!!device} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Topilgan qurilmani qo'shish</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{device.serialNumber}</span> —{' '}
            {device.ipv4Address}:{device.httpPort}
            {device.deviceType && (
              <>
                {' · '}
                {device.deviceType}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-name">Nomi</Label>
            <Input
              id="d-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="d-user">Login</Label>
              <Input
                id="d-user"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-pass">Parol</Label>
              <Input
                id="d-pass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-mode">Rejim</Label>
            <Select
              id="d-mode"
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as 'entry' | 'exit' | 'both')
              }
            >
              <option value="both">Kirish/Chiqish (both)</option>
              <option value="entry">Faqat kirish</option>
              <option value="exit">Faqat chiqish</option>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              Qo'shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DiscoveredDevicesSection({ agentId }: { agentId: string }) {
  const { data, isLoading } = useAgentDiscovered(agentId);
  const [adding, setAdding] = useState<DiscoveredDeviceDto | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-(--color-muted-foreground)">
        <Loader2 className="h-3 w-3 animate-spin" /> SADP discovery...
      </div>
    );
  }
  if (!data) return null;

  const total =
    (data.newDevices?.length ?? 0) + (data.knownDevices?.length ?? 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Radar className="h-4 w-4 text-(--color-muted-foreground)" />
        Tarmoqda topilgan qurilmalar
        <span className="text-(--color-muted-foreground) font-normal">
          ({total})
        </span>
        {data.error && (
          <span className="flex items-center gap-1 text-xs text-(--color-destructive)">
            <AlertTriangle className="h-3 w-3" />
            {data.error}
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="text-xs text-(--color-muted-foreground)">
          Hech qanday qurilma topilmadi. SADP UDP 37020 multicast'i orqali
          tarmoqda Hikvision qurilmalari skanerlanadi (har 30s'da).
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-(--color-border) bg-(--color-card)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seriya</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>MAC</TableHead>
                <TableHead className="text-right">Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.newDevices?.map((d) => (
                <TableRow key={d.serialNumber}>
                  <TableCell className="font-mono text-xs">
                    {d.serialNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.ipv4Address}:{d.httpPort}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.deviceType ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.macAddress ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => setAdding(d)}>
                      <PlusCircle className="h-4 w-4" />
                      Qo'shish
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.knownDevices?.map((d) => (
                <TableRow key={d.serialNumber} className="opacity-70">
                  <TableCell className="font-mono text-xs">
                    {d.serialNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.ipv4Address}:{d.httpPort}
                  </TableCell>
                  <TableCell className="text-sm">
                    {d.deviceType ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.macAddress ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">DB'da: {d.dbName}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddDiscoveredDialog
        agentId={agentId}
        device={adding}
        onOpenChange={(o) => !o && setAdding(null)}
        onCreated={() => setAdding(null)}
      />
    </div>
  );
}

function AgentInspectPanel({ agentId }: { agentId: string }) {
  const { data, isLoading, isError, error } = useAgentInspect(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-(--color-muted-foreground)">
        <Loader2 className="h-4 w-4 animate-spin" /> Agentdan ma'lumot olinmoqda...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-3 text-sm text-(--color-destructive)">
        Xato: {getApiErrorMessage(error)}
      </div>
    );
  }

  const allDeviceIds = new Set<string>();
  data.expected.forEach((d) => allDeviceIds.add(d.id));
  data.actual.forEach((d) => allDeviceIds.add(d.id));

  const rows = [...allDeviceIds].map((id) => {
    const exp = data.expected.find((d) => d.id === id);
    const act = data.actual.find((d) => d.id === id);
    return {
      id,
      name: exp?.name ?? act?.name ?? '—',
      host: exp?.host ?? act?.host ?? '—',
      port: exp?.port ?? act?.port,
      mode: exp?.mode ?? act?.mode ?? '—',
      inDb: !!exp,
      inAgent: !!act,
      online: act?.online ?? false,
    };
  });

  return (
    <div className="space-y-3 bg-(--color-secondary)/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={data.isOnline ? 'success' : 'secondary'}>
          {data.isOnline ? 'Agent online' : 'Agent offline'}
        </Badge>
        <span className="text-(--color-muted-foreground)">
          DB'da kutilmoqda: <strong>{data.expectedCount}</strong> · Agent
          ko'rmoqda: <strong>{data.actualCount}</strong>
        </span>
        {data.error && (
          <span className="flex items-center gap-1 text-(--color-destructive)">
            <AlertTriangle className="h-4 w-4" />
            {data.error}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-2 text-sm text-(--color-muted-foreground)">
          Bu agentga hech qanday qurilma biriktirilmagan.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-(--color-border) bg-(--color-card)">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Qurilma</TableHead>
                <TableHead>Manzil</TableHead>
                <TableHead>Rejim</TableHead>
                <TableHead>DB</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Holat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.host}:{r.port ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm">{r.mode}</TableCell>
                  <TableCell>
                    {r.inDb ? (
                      <Badge variant="secondary">✓</Badge>
                    ) : (
                      <Badge variant="destructive">yo'q</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.inAgent ? (
                      <Badge variant="secondary">✓</Badge>
                    ) : (
                      <Badge variant="destructive">yo'q</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!r.inAgent ? (
                      <span className="text-xs text-(--color-muted-foreground)">
                        sinxron emas
                      </span>
                    ) : r.online ? (
                      <Badge variant="success">Online</Badge>
                    ) : (
                      <Badge variant="secondary">Offline</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DiscoveredDevicesSection agentId={agentId} />
    </div>
  );
}

export function AgentsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const [companyFilter, setCompanyFilter] = useState('');
  const { data, isLoading } = useAgents(
    isSuper && companyFilter ? companyFilter : undefined,
  );
  const { data: companies } = useCompanies();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const remove = useDeleteAgent();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState<Agent | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      {isSuper && (
        <div className="mb-4 flex items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="filter-company" className="text-xs">
              Kampaniya bo'yicha filter
            </Label>
            <Select
              id="filter-company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="min-w-[220px]"
            >
              <option value="">Hammasi</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {companyFilter && (
            <Button variant="outline" onClick={() => setCompanyFilter('')}>
              Tozalash
            </Button>
          )}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Nomi (AGENT_NAME)</TableHead>
              {isSuper && <TableHead>Kampaniya</TableHead>}
              <TableHead>Holat</TableHead>
              <TableHead>So'nggi ulanish</TableHead>
              <TableHead className="w-[100px] text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} message="Yuklanmoqda..." />
            ) : (data ?? []).length === 0 ? (
              <TableEmpty colSpan={isSuper ? 6 : 5} />
            ) : (
              (data ?? []).flatMap((a) => {
                const expanded = expandedId === a.id;
                return [
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-(--color-secondary)/40"
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                  >
                    <TableCell>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-(--color-muted-foreground)" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-(--color-muted-foreground)" />
                      )}
                    </TableCell>
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
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                  </TableRow>,
                  expanded && (
                    <TableRow
                      key={`${a.id}-inspect`}
                      className="bg-transparent hover:bg-transparent"
                    >
                      <TableCell colSpan={isSuper ? 6 : 5} className="p-0">
                        <AgentInspectPanel agentId={a.id} />
                      </TableCell>
                    </TableRow>
                  ),
                ];
              })
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
