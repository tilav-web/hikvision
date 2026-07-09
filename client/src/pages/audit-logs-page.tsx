import { useState } from 'react';
import { ChevronLeft, ChevronRight, DoorOpen, ScanFace, IdCard, RotateCw, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditLogs, type AuditLog } from '@/api/audit';

const ACTION_META: Record<string, { label: string; icon: typeof DoorOpen; variant: string }> = {
  'door.open': { label: 'Eshik ochildi', icon: DoorOpen, variant: 'warning' },
  'device.reboot': { label: 'Qurilma qayta yuklandi', icon: RotateCw, variant: 'default' },
  'device.create': { label: 'Qurilma qo\'shildi', icon: ScanFace, variant: 'success' },
  'device.delete': { label: 'Qurilma o\'chirildi', icon: ScanFace, variant: 'destructive' },
  'person.create': { label: 'Hodim qo\'shildi', icon: IdCard, variant: 'success' },
  'person.delete': { label: 'Hodim o\'chirildi', icon: IdCard, variant: 'destructive' },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function detailsText(row: AuditLog): string {
  if (!row.details) return '—';
  const d = row.details;
  const name = (d.deviceName ?? d.name) as string | undefined;
  const extra: string[] = [];
  if (d.doorNo != null) extra.push(`eshik ${d.doorNo}`);
  if (d.employeeNo != null) extra.push(`tabel ${d.employeeNo}`);
  if (d.host != null) extra.push(String(d.host));
  return [name, ...extra].filter(Boolean).join(' · ') || '—';
}

export function AuditLogsPage() {
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const { data, isLoading } = useAuditLogs({ skip: page * PAGE_SIZE, take: PAGE_SIZE });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Audit jurnali"
        description="Kim qachon nima qildi — muhim amallar tarixi"
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Vaqt</TableHead>
              <TableHead>Foydalanuvchi</TableHead>
              <TableHead>Amal</TableHead>
              <TableHead>Tafsilot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableEmpty colSpan={4} message="Yuklanmoqda..." />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={4} message="Jurnal bo'sh" />
            ) : (
              items.map((row) => {
                const meta = ACTION_META[row.action] ?? {
                  label: row.action,
                  icon: ShieldAlert,
                  variant: 'default' as const,
                };
                const Icon = meta.icon;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-(--color-muted-foreground) tabular-nums">
                      {fmtTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.userEmail ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={meta.variant as never}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{detailsText(row)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-(--color-border) px-4 py-3">
            <span className="text-sm text-(--color-muted-foreground)">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Oldingi
              </Button>
              <span className="text-sm tabular-nums">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                Keyingi <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
