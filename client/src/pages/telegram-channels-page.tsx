import { useMemo, useState, type FormEvent } from 'react';
import {
  MessagesSquare,
  Plus,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Loader2,
  Globe,
  Building2,
  Info,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useBotInfo,
  useCreateChannel,
  useDeleteChannel,
  useTelegramChannels,
  useTestChannel,
  type ChannelInput,
  type TelegramChannel,
} from '@/api/telegram-channels';
import { useCompanies } from '@/api/companies';
import { useAuthStore } from '@/stores/auth-store';
import { getApiErrorMessage } from '@/lib/api';

type Filter = 'all' | 'global' | 'company';

export function TelegramChannelsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const [filter, setFilter] = useState<Filter>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('');

  const queryOpts = useMemo(() => {
    if (!isSuper) return {};
    if (filter === 'global') return { onlyGlobal: true };
    if (filter === 'company' && companyFilter)
      return { companyId: companyFilter };
    return {};
  }, [isSuper, filter, companyFilter]);

  const { data: channels, isLoading } = useTelegramChannels(queryOpts);
  const { data: companies } = useCompanies();
  const { data: botInfo } = useBotInfo();
  const create = useCreateChannel();
  const remove = useDeleteChannel();
  const test = useTestChannel();

  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<TelegramChannel | null>(null);

  const onlineCount = (channels ?? []).filter((c) => c.isMember).length;
  const offlineCount = (channels ?? []).filter((c) => !c.isMember).length;

  const onSubmit = (input: ChannelInput) => {
    create.mutate(input, {
      onSuccess: () => {
        toast.success(
          'Kanal qo\'shildi va test xabar yuborildi. Telegram\'da tekshiring.',
        );
        setFormOpen(false);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  const onDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success("O'chirildi");
        setDeleting(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  const onTest = (ch: TelegramChannel) => {
    test.mutate(ch.id, {
      onSuccess: (res) => {
        if (res.ok) toast.success('Test xabar yuborildi');
        else toast.error(`Xato: ${res.error}`);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
  };

  return (
    <div>
      <PageHeader
        title="Telegram kanallar"
        description="Bildirishnomalar yuboriladigan kanallar/guruhlar. Botni kanalda admin qiling va chat ID'ni shu yerga kiriting."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus /> Yangi kanal
          </Button>
        }
      />

      {/* Bot info banner */}
      <Card className="p-4 mb-4">
        {botInfo?.ready ? (
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>
              Bot:{' '}
              <a
                href={`https://t.me/${botInfo.username}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold text-(--color-primary) hover:underline"
              >
                @{botInfo.username}
              </a>
            </span>
            <span className="text-(--color-muted-foreground)">
              · {onlineCount} kanal aktiv · {offlineCount} aktiv emas
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-(--color-destructive)">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Bot ishga tushmagan</div>
              <div className="text-(--color-muted-foreground) mt-1">
                Server <code>.env</code>'da{' '}
                <code className="font-mono">TELEGRAM_BOT_TOKEN</code> kiritilmagan
                yoki noto'g'ri. Bot tokenini @BotFather'dan oling.
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Filter (super_admin) */}
      {isSuper && (
        <Card className="p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-(--color-muted-foreground) uppercase tracking-wide mr-1">
            Filter:
          </span>
          <FilterChip
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Hammasi
          </FilterChip>
          <FilterChip
            active={filter === 'global'}
            onClick={() => setFilter('global')}
          >
            <Globe className="h-3.5 w-3.5" /> Global
          </FilterChip>
          <FilterChip
            active={filter === 'company'}
            onClick={() => setFilter('company')}
          >
            <Building2 className="h-3.5 w-3.5" /> Kampaniya bo'yicha
          </FilterChip>
          {filter === 'company' && (
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="ml-2 min-w-[200px]"
            >
              <option value="">Tanlang...</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Card>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-(--color-muted-foreground)">
          <Loader2 className="h-5 w-5 animate-spin" /> Yuklanmoqda...
        </div>
      ) : (channels ?? []).length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-(--color-muted-foreground) text-center">
          <MessagesSquare className="h-10 w-10" />
          <span className="text-sm font-medium">Hech qanday kanal yo'q</span>
          <span className="text-xs max-w-md">
            Telegram'da yangi kanal/guruh ochib, ushbu botni admin qiling, so'ng
            "Yangi kanal" tugmasini bosib chat ID'ni kiriting.
          </span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(channels ?? []).map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              onTest={() => onTest(ch)}
              onDelete={() => setDeleting(ch)}
              testing={test.isPending && test.variables === ch.id}
            />
          ))}
        </div>
      )}

      <ChannelFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        isSuper={isSuper}
        companies={companies ?? []}
        loading={create.isPending}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Kanalni o'chirish?"
        description={`${
          deleting?.title ?? deleting?.chatId
        } kanaliga bildirishnomalar yuborilmaydi. Botning kanaldagi adminligi o'chmaydi (qo'lda olib tashlash kerak).`}
        destructive
        loading={remove.isPending}
        confirmText="O'chirish"
        onConfirm={onDelete}
      />
    </div>
  );
}

// ───── tarkibiy komponentlar ─────

function FilterChip({
  active,
  onClick,
  children,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}>) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-(--color-primary) text-(--color-primary-foreground)'
          : 'bg-(--color-secondary)/50 hover:bg-(--color-secondary) text-(--color-foreground)'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ ch }: Readonly<{ ch: TelegramChannel }>) {
  if (!ch.isActive) return <Badge variant="secondary">O'chirilgan</Badge>;
  if (ch.isMember && ch.botStatus === 'administrator') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" /> Admin
      </Badge>
    );
  }
  if (ch.isMember) {
    return <Badge variant="success">Bot kanalda</Badge>;
  }
  if (ch.botStatus === 'kicked' || ch.botStatus === 'left') {
    return (
      <Badge variant="destructive">
        <CircleSlash className="h-3 w-3" /> Bot chiqarilgan
      </Badge>
    );
  }
  return <Badge variant="outline">Noma'lum</Badge>;
}

function ChannelCard({
  channel: ch,
  onTest,
  onDelete,
  testing,
}: Readonly<{
  channel: TelegramChannel;
  onTest: () => void;
  onDelete: () => void;
  testing: boolean;
}>) {
  const isGlobal = ch.companyId === null;
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessagesSquare className="h-4 w-4 text-(--color-muted-foreground) shrink-0" />
            <h3 className="font-semibold truncate">
              {ch.title || 'Nomi belgilanmagan'}
            </h3>
          </div>
          <div className="text-xs font-mono text-(--color-muted-foreground) truncate">
            {ch.chatId}
          </div>
        </div>
        <StatusBadge ch={ch} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {isGlobal ? (
          <Badge variant="outline" className="gap-1">
            <Globe className="h-3 w-3" /> Global
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <Building2 className="h-3 w-3" /> {ch.company?.name ?? 'Kampaniya'}
          </Badge>
        )}
        {ch.enabledEvents.length === 0 ? (
          <Badge variant="secondary">Barcha event'lar</Badge>
        ) : (
          ch.enabledEvents.map((e) => (
            <Badge key={e} variant="secondary">
              {e}
            </Badge>
          ))
        )}
      </div>

      {ch.lastSeenAt && (
        <div className="text-xs text-(--color-muted-foreground)">
          Oxirgi faollik: {new Date(ch.lastSeenAt).toLocaleString('uz-UZ')}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={testing}
          className="flex-1"
        >
          {testing ? <Loader2 className="animate-spin" /> : <Send />}
          Test
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </Card>
  );
}

function ChannelFormDialog({
  open,
  onOpenChange,
  isSuper,
  companies,
  loading,
  onSubmit,
}: Readonly<{
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isSuper: boolean;
  companies: Array<{ id: string; name: string }>;
  loading: boolean;
  onSubmit: (input: ChannelInput) => void;
}>) {
  const [chatId, setChatId] = useState('');
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<'global' | 'company'>('company');
  const [companyId, setCompanyId] = useState('');

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const input: ChannelInput = {
      chatId: chatId.trim(),
      title: title.trim() || undefined,
    };
    if (isSuper && scope === 'company' && companyId) {
      input.companyId = companyId;
    }
    // company_admin uchun server avtomatik o'z kampaniyasiga bog'laydi
    onSubmit(input);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setChatId('');
          setTitle('');
          setScope('company');
          setCompanyId('');
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yangi Telegram kanal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handle} className="space-y-4">
          <div className="rounded-md border border-(--color-border) bg-(--color-secondary)/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Info className="h-3.5 w-3.5" /> Qadamlar:
            </div>
            <ol className="list-decimal pl-5 space-y-0.5 text-(--color-muted-foreground)">
              <li>Telegram'da yangi kanal yoki guruh oching</li>
              <li>Botni admin qiling (xabar yuborish huquqi bilan)</li>
              <li>Chat ID'sini bu yerga kiriting (-100... formatida)</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-id">Chat ID</Label>
            <Input
              id="ch-id"
              required
              pattern="^-?\d+$"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="font-mono"
            />
            <p className="text-xs text-(--color-muted-foreground)">
              @userinfobot ga kanaldagi xabarni forward qilib chat ID ni oling.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-title">Nomi (ixtiyoriy)</Label>
            <Input
              id="ch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Hikvision Alerts"
            />
          </div>

          {isSuper && (
            <div className="space-y-2">
              <Label>Kanal turi</Label>
              <div className="flex gap-2">
                <ScopeOption
                  active={scope === 'company'}
                  onClick={() => setScope('company')}
                  icon={<Building2 className="h-4 w-4" />}
                  label="Kampaniya"
                  hint="Faqat tanlangan kampaniya event'lari"
                />
                <ScopeOption
                  active={scope === 'global'}
                  onClick={() => setScope('global')}
                  icon={<Globe className="h-4 w-4" />}
                  label="Global"
                  hint="Barcha kampaniyalar event'lari (super_admin uchun)"
                />
              </div>
              {scope === 'company' && (
                <Select
                  required
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Kampaniyani tanlang...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

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
              Qo'shish va test xabar yuborish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  active,
  onClick,
  icon,
  label,
  hint,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border p-3 text-left transition-colors ${
        active
          ? 'border-(--color-primary) bg-(--color-primary)/10'
          : 'border-(--color-border) hover:bg-(--color-secondary)/40'
      }`}
    >
      <div className="flex items-center gap-2 font-medium text-sm">
        {icon}
        {label}
      </div>
      <div className="text-xs text-(--color-muted-foreground) mt-1">{hint}</div>
    </button>
  );
}
