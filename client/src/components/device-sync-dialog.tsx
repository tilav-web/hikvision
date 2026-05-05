import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ScanFace,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  useDeviceSyncCompare,
  useDeleteFromDevice,
  useImportFromDevice,
  usePushToDevice,
  type CompareResult,
} from '@/api/devices';
import type { Device } from '@/api/types';
import { getApiErrorMessage } from '@/lib/api';

type Tab = 'onlyDevice' | 'onlyDb' | 'mismatched';

/**
 * Aparat ↔ DB user'larini solishtirish va tanlangan amallarni qo'llash.
 * 3 tab:
 *   - "Faqat aparatda" — DB'da yo'q — import qilish yoki aparatdan o'chirish
 *   - "Faqat DB'da"   — aparatda yo'q — push qilish (sinxronlash)
 *   - "Farqli"        — ikki tomonda bor lekin nom/karta farq qiladi
 */
export function DeviceSyncDialog({
  device,
  open,
  onOpenChange,
}: Readonly<{
  device: Device | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}>) {
  const [tab, setTab] = useState<Tab>('onlyDevice');
  const [selectedDevice, setSelectedDevice] = useState<Set<string>>(new Set());
  const [selectedDb, setSelectedDb] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, isFetching, refetch, isError, error } =
    useDeviceSyncCompare(open ? device?.id ?? null : null);

  const importMut = useImportFromDevice();
  const pushMut = usePushToDevice();
  const deleteMut = useDeleteFromDevice();

  // Modal yopilganda holatni tozalash
  useEffect(() => {
    if (!open) {
      setSelectedDevice(new Set());
      setSelectedDb(new Set());
      setTab('onlyDevice');
    }
  }, [open]);

  const onlyOnDevice = data?.onlyOnDevice ?? [];
  const onlyInDb = data?.onlyInDb ?? [];
  const mismatched = data?.mismatched ?? [];

  // Counts
  const counts = useMemo(
    () => ({
      onlyDevice: onlyOnDevice.length,
      onlyDb: onlyInDb.length,
      mismatched: mismatched.length,
      matched: data?.matched.length ?? 0,
    }),
    [onlyOnDevice, onlyInDb, mismatched, data],
  );

  if (!device) return null;

  const allDeviceSelected =
    onlyOnDevice.length > 0 && selectedDevice.size === onlyOnDevice.length;
  const allDbSelected =
    onlyInDb.length > 0 && selectedDb.size === onlyInDb.length;

  const toggleDevice = (empNo: string) => {
    const next = new Set(selectedDevice);
    if (next.has(empNo)) next.delete(empNo);
    else next.add(empNo);
    setSelectedDevice(next);
  };
  const toggleAllDevice = () => {
    if (allDeviceSelected) setSelectedDevice(new Set());
    else setSelectedDevice(new Set(onlyOnDevice.map((u) => u.employeeNo)));
  };
  const toggleDb = (id: string) => {
    const next = new Set(selectedDb);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDb(next);
  };
  const toggleAllDb = () => {
    if (allDbSelected) setSelectedDb(new Set());
    else setSelectedDb(new Set(onlyInDb.map((p) => p.id)));
  };

  const onImport = () => {
    if (selectedDevice.size === 0) return;
    importMut.mutate(
      { deviceId: device.id, employeeNos: [...selectedDevice] },
      {
        onSuccess: (res) => {
          toast.success(
            `${res.created.length} hodim DB'ga import qilindi${
              res.skipped.length
                ? `, ${res.skipped.length} skipped`
                : ''
            }`,
          );
          setSelectedDevice(new Set());
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const onPush = () => {
    if (selectedDb.size === 0) return;
    pushMut.mutate(
      { deviceId: device.id, personIds: [...selectedDb] },
      {
        onSuccess: (res) => {
          if (res.failed.length === 0) {
            toast.success(`${res.success.length} hodim aparatga yuborildi`);
          } else {
            toast.warning(
              `${res.success.length}/${
                res.success.length + res.failed.length
              } muvaffaqiyatli, qolgani xato`,
            );
          }
          setSelectedDb(new Set());
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const onDeleteFromDevice = () => {
    if (selectedDevice.size === 0) return;
    setConfirmDelete(true);
  };

  const performDelete = () => {
    deleteMut.mutate(
      { deviceId: device.id, employeeNos: [...selectedDevice] },
      {
        onSuccess: (res) => {
          toast.success(`Aparatdan ${res.success.length} ta o'chirildi`);
          setSelectedDevice(new Set());
          setConfirmDelete(false);
        },
        onError: (e) => {
          toast.error(getApiErrorMessage(e));
          setConfirmDelete(false);
        },
      },
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 gap-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="px-5 py-3 border-b border-(--color-border)">
            <DialogTitle className="flex items-center gap-3">
              <ArrowRightLeft className="h-5 w-5" />
              <span>Sinxronlash: {device.name}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {device.host}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Status + refresh */}
          <div className="px-5 py-3 border-b border-(--color-border) flex items-center justify-between gap-3">
            {data && (
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <ScanFace className="h-4 w-4 text-(--color-muted-foreground)" />
                  Aparatda: <strong>{data.total.device}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-(--color-muted-foreground)" />
                  DB'da: <strong>{data.total.db}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Mos kelgan: <strong>{counts.matched}</strong>
                </span>
              </div>
            )}
            {!data && isLoading && (
              <span className="inline-flex items-center gap-2 text-sm text-(--color-muted-foreground)">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aparat o'qilmoqda (5-15s davom etishi mumkin)...
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
              Qayta o'qish
            </Button>
          </div>

          {isError ? (
            <div className="p-12 flex flex-col items-center gap-3 text-(--color-destructive) text-center">
              <AlertCircle className="h-10 w-10" />
              <span className="font-medium">Solishtirish xatosi</span>
              <span className="text-sm text-(--color-muted-foreground) max-w-md">
                {getApiErrorMessage(error)}
              </span>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="px-5 py-2 border-b border-(--color-border) flex gap-1">
                <TabButton
                  active={tab === 'onlyDevice'}
                  onClick={() => setTab('onlyDevice')}
                  count={counts.onlyDevice}
                  tone="warning"
                >
                  <ScanFace className="h-3.5 w-3.5" /> Faqat aparatda
                </TabButton>
                <TabButton
                  active={tab === 'onlyDb'}
                  onClick={() => setTab('onlyDb')}
                  count={counts.onlyDb}
                  tone="info"
                >
                  <Database className="h-3.5 w-3.5" /> Faqat DB'da
                </TabButton>
                <TabButton
                  active={tab === 'mismatched'}
                  onClick={() => setTab('mismatched')}
                  count={counts.mismatched}
                  tone="warning"
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Farqli
                </TabButton>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {tab === 'onlyDevice' && (
                  <DeviceList
                    items={onlyOnDevice}
                    selected={selectedDevice}
                    onToggle={toggleDevice}
                    onToggleAll={toggleAllDevice}
                    allSelected={allDeviceSelected}
                    emptyText="Aparatda DB'da yo'q hodim topilmadi"
                  />
                )}
                {tab === 'onlyDb' && (
                  <DbList
                    items={onlyInDb}
                    selected={selectedDb}
                    onToggle={toggleDb}
                    onToggleAll={toggleAllDb}
                    allSelected={allDbSelected}
                    emptyText="DB'da aparatda yo'q hodim topilmadi"
                  />
                )}
                {tab === 'mismatched' && (
                  <MismatchedList items={mismatched} />
                )}
              </div>

              {/* Actions */}
              <div className="px-5 py-3 border-t border-(--color-border) flex items-center justify-between gap-3 bg-(--color-card)">
                <span className="text-xs text-(--color-muted-foreground)">
                  {tab === 'onlyDevice' &&
                    `${selectedDevice.size} ta tanlandi`}
                  {tab === 'onlyDb' && `${selectedDb.size} ta tanlandi`}
                  {tab === 'mismatched' &&
                    'Mos kelmaydigan yozuvlarni qo\'lda tahrirlang (avtomatik tuzatish hozir yo\'q)'}
                </span>

                {tab === 'onlyDevice' && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onDeleteFromDevice}
                      disabled={
                        selectedDevice.size === 0 || deleteMut.isPending
                      }
                    >
                      {deleteMut.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                      Aparatdan o'chirish
                    </Button>
                    <Button
                      size="sm"
                      onClick={onImport}
                      disabled={
                        selectedDevice.size === 0 || importMut.isPending
                      }
                    >
                      {importMut.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                      DB'ga import qilish
                    </Button>
                  </div>
                )}

                {tab === 'onlyDb' && (
                  <Button
                    size="sm"
                    onClick={onPush}
                    disabled={selectedDb.size === 0 || pushMut.isPending}
                  >
                    {pushMut.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Upload />
                    )}
                    Aparatga push qilish
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Aparatdan o'chirish?"
        description={`${selectedDevice.size} ta hodim ${device.name} aparatidan o'chiriladi. DB tegmaydi.`}
        destructive
        confirmText="O'chirish"
        loading={deleteMut.isPending}
        onConfirm={performDelete}
      />
    </>
  );
}

// ───── tarkibiy komponentlar ─────

function TabButton({
  active,
  onClick,
  count,
  tone,
  children,
}: Readonly<{
  active: boolean;
  onClick: () => void;
  count: number;
  tone: 'warning' | 'info';
  children: React.ReactNode;
}>) {
  let countCls = 'bg-(--color-secondary) text-(--color-secondary-foreground)';
  if (count > 0) {
    if (tone === 'warning') countCls = 'bg-amber-500/20 text-amber-700';
    else if (tone === 'info') countCls = 'bg-blue-500/20 text-blue-700';
  }
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-(--color-secondary) text-(--color-secondary-foreground)'
          : 'hover:bg-(--color-secondary)/50 text-(--color-muted-foreground)'
      }`}
    >
      {children}
      <span className={`inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full text-xs font-mono ${countCls}`}>
        {count}
      </span>
    </button>
  );
}

function DeviceList({
  items,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  emptyText,
}: Readonly<{
  items: CompareResult['onlyOnDevice'];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  emptyText: string;
}>) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-(--color-muted-foreground)">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
        {emptyText}
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-(--color-card) border-b border-(--color-border) text-left text-xs uppercase tracking-wide text-(--color-muted-foreground)">
        <tr>
          <th className="px-5 py-2 w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4"
            />
          </th>
          <th className="px-3 py-2">Tabel</th>
          <th className="px-3 py-2">Ism</th>
          <th className="px-3 py-2">Tur</th>
          <th className="px-3 py-2">Karta</th>
        </tr>
      </thead>
      <tbody>
        {items.map((u) => (
          <tr
            key={u.employeeNo}
            className="border-b border-(--color-border)/50 hover:bg-(--color-secondary)/30"
          >
            <td className="px-5 py-2">
              <input
                type="checkbox"
                checked={selected.has(u.employeeNo)}
                onChange={() => onToggle(u.employeeNo)}
                className="h-4 w-4"
              />
            </td>
            <td className="px-3 py-2 font-mono text-xs">{u.employeeNo}</td>
            <td className="px-3 py-2">{u.name || '—'}</td>
            <td className="px-3 py-2 text-xs text-(--color-muted-foreground)">
              {u.userType ?? 'normal'}
            </td>
            <td className="px-3 py-2 font-mono text-xs">
              {u.cardNo || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DbList({
  items,
  selected,
  onToggle,
  onToggleAll,
  allSelected,
  emptyText,
}: Readonly<{
  items: CompareResult['onlyInDb'];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  emptyText: string;
}>) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-(--color-muted-foreground)">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
        {emptyText}
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-(--color-card) border-b border-(--color-border) text-left text-xs uppercase tracking-wide text-(--color-muted-foreground)">
        <tr>
          <th className="px-5 py-2 w-10">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4"
            />
          </th>
          <th className="px-3 py-2">Tabel</th>
          <th className="px-3 py-2">Ism</th>
          <th className="px-3 py-2">Karta</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p) => (
          <tr
            key={p.id}
            className="border-b border-(--color-border)/50 hover:bg-(--color-secondary)/30"
          >
            <td className="px-5 py-2">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
                className="h-4 w-4"
              />
            </td>
            <td className="px-3 py-2 font-mono text-xs">{p.employeeNo}</td>
            <td className="px-3 py-2">{p.name}</td>
            <td className="px-3 py-2 font-mono text-xs">
              {p.cardNo || '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MismatchedList({
  items,
}: Readonly<{ items: CompareResult['mismatched'] }>) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-sm text-(--color-muted-foreground)">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
        Farqli yozuvlar yo'q
      </div>
    );
  }
  return (
    <div className="divide-y divide-(--color-border)/50">
      {items.map((m) => (
        <div key={m.employeeNo} className="px-5 py-3">
          <div className="font-mono text-xs text-(--color-muted-foreground) mb-2">
            #{m.employeeNo} — farq: {m.diffs.join(', ')}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-(--color-border) p-2 bg-(--color-secondary)/30">
              <div className="text-xs uppercase tracking-wide text-(--color-muted-foreground) mb-1">
                Aparatda
              </div>
              <div>{m.deviceUser.name || '—'}</div>
              {m.deviceUser.cardNo && (
                <div className="font-mono text-xs mt-1">
                  {m.deviceUser.cardNo}
                </div>
              )}
            </div>
            <div className="rounded-md border border-(--color-border) p-2 bg-(--color-secondary)/30">
              <div className="text-xs uppercase tracking-wide text-(--color-muted-foreground) mb-1">
                DB'da
              </div>
              <div>{m.dbPerson.name}</div>
              {m.dbPerson.cardNo && (
                <div className="font-mono text-xs mt-1">
                  {m.dbPerson.cardNo}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
