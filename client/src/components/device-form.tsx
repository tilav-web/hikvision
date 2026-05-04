import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { Agent, Company, Device, DeviceMode } from '@/api/types';
import type { DeviceInput } from '@/api/devices';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: Device | null;
  companies: Company[];
  agents: Agent[];
  isSuper: boolean;
  loading: boolean;
  onSubmit: (dto: Partial<DeviceInput>) => void;
}

export function DeviceForm({
  open,
  onOpenChange,
  initial,
  companies,
  agents,
  isSuper,
  loading,
  onSubmit,
}: Props) {
  const isEdit = !!initial;
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [mode, setMode] = useState<DeviceMode>('both');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCompanyId(initial?.companyId ?? '');
      setAgentId(initial?.agentId ?? '');
      setMode(initial?.mode ?? 'both');
      setHost(initial?.host ?? '');
      setPort(String(initial?.port ?? ''));
      setUseHttps(initial?.useHttps ?? false);
      setUsername(initial?.username ?? 'admin');
      setPassword('');
      setLocation(initial?.location ?? '');
    }
  }, [open, initial]);

  const filteredAgents = agents.filter(
    (a) => !companyId || !a.companyId || a.companyId === companyId,
  );

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const dto: Partial<DeviceInput> = {
      name: name.trim(),
      mode,
      host: host.trim(),
      port: port ? Number(port) : undefined,
      useHttps,
      username: username.trim(),
      location: location.trim() || undefined,
      agentId: agentId || undefined,
    };
    if (!isEdit) {
      dto.companyId = isSuper ? companyId || undefined : undefined;
    }
    if (password) dto.password = password;
    onSubmit(dto);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Qurilmani tahrirlash' : 'Yangi qurilma'}
          </DialogTitle>
          <DialogDescription>
            Qurilmani agentga biriktirsangiz, agent serverdan buyruqlarni qabul
            qilib qurilmaga uzatadi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="d-name">Nomi</Label>
              <Input
                id="d-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asosiy kirish"
              />
            </div>

            {!isEdit && isSuper && (
              <div className="space-y-2">
                <Label htmlFor="d-company">Kampaniya</Label>
                <Select
                  id="d-company"
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
              <Label htmlFor="d-agent">Agent</Label>
              <Select
                id="d-agent"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">— biriktirilmagan —</option>
                {filteredAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.isOnline ? '(online)' : ''}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="d-mode">Rejim</Label>
              <Select
                id="d-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as DeviceMode)}
              >
                <option value="both">Kirish + Chiqish (tugma)</option>
                <option value="entry">Faqat kirish</option>
                <option value="exit">Faqat chiqish</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="d-host">IP / Host</Label>
              <Input
                id="d-host"
                required
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.64"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-port">Port</Label>
              <Input
                id="d-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={useHttps ? '443' : '80'}
              />
            </div>
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
              <Label htmlFor="d-pass">
                {isEdit ? 'Yangi parol (bo\'sh — o\'zgarmaydi)' : 'Parol'}
              </Label>
              <Input
                id="d-pass"
                type="password"
                required={!isEdit}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="d-loc">Joylashuv</Label>
              <Input
                id="d-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bosh ofis, 1-qavat"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="d-https"
                type="checkbox"
                checked={useHttps}
                onChange={(e) => setUseHttps(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border)"
              />
              <Label htmlFor="d-https" className="cursor-pointer">
                HTTPS ishlatish
              </Label>
            </div>
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
