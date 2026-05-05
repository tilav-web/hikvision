import { useMemo, useState } from 'react';
import { Camera, AlertCircle, Loader2, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CameraTile } from '@/components/camera-tile';
import { CameraViewer } from '@/components/camera-viewer';
import { useDevices } from '@/api/devices';
import { useCompanies } from '@/api/companies';
import { useAuthStore } from '@/stores/auth-store';
import type { Device } from '@/api/types';

/**
 * Kameralar grid'i. Polling sahifa ko'rinib turganda har CameraTile ichida.
 *
 * UX:
 *  - super_admin: kampaniya filteri, barcha kampaniyalar qurilmalari
 *  - company_admin: faqat o'z kampaniyasi (server filterlaydi)
 *  - Search: nom yoki host bo'yicha
 *  - Tile bosish → kengaytirilgan modal (yuqori fps + boshqaruv)
 */
export function CamerasPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isSuper = role === 'super_admin';

  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  const { data: companies } = useCompanies();
  const {
    data: devices,
    isLoading,
    isError,
    error,
  } = useDevices({ companyId: isSuper ? companyFilter || undefined : undefined });

  const filtered = useMemo(() => {
    if (!devices) return [];
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.host.toLowerCase().includes(q) ||
        (d.location?.toLowerCase().includes(q) ?? false),
    );
  }, [devices, search]);

  const onlineCount = filtered.filter((d) => d.isOnline).length;

  return (
    <div>
      <PageHeader
        title="Kameralar"
        description="Qurilmalarning jonli kadrlari (snapshot polling). Tile'ni bosib kengaytiring."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success">{onlineCount} online</Badge>
            <Badge variant="outline">{filtered.length} jami</Badge>
          </div>
        }
      />

      {/* Filterlar */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-muted-foreground)" />
            <Input
              placeholder="Nom, IP yoki joylashuv bo'yicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {isSuper && (
            <Select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="min-w-[200px]"
            >
              <option value="">Barcha kampaniyalar</option>
              {(companies ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-(--color-muted-foreground)">
          <Loader2 className="h-5 w-5 animate-spin" /> Qurilmalar yuklanmoqda...
        </div>
      ) : isError ? (
        <Card className="p-8 flex flex-col items-center gap-2 text-(--color-destructive)">
          <AlertCircle className="h-8 w-8" />
          <span>{(error as Error)?.message || 'Yuklab bo\'lmadi'}</span>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-(--color-muted-foreground)">
          <Camera className="h-10 w-10" />
          <span className="text-sm">
            {devices?.length
              ? 'Filterga mos qurilma yo\'q'
              : 'Hech qanday qurilma yo\'q. Qurilmalar sahifasida qo\'shing.'}
          </span>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <CameraTile
              key={d.id}
              device={d}
              // Modal ochilsa fonidagi tile polling'ini to'xtatamiz —
              // bandwidth tejaymiz, faqat modal yuqori fps'da yangilanadi.
              active={activeDevice?.id !== d.id}
              fps={1}
              onOpen={() => setActiveDevice(d)}
            />
          ))}
        </div>
      )}

      <CameraViewer
        device={activeDevice}
        open={!!activeDevice}
        onOpenChange={(o) => !o && setActiveDevice(null)}
      />
    </div>
  );
}
