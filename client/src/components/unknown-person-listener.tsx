import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import {
  useUnknownPersonSocket,
  type UnknownPersonPayload,
} from '@/hooks/use-unknown-person-socket';
import { useImportFromDevice } from '@/api/devices';
import { getApiErrorMessage } from '@/lib/api';

/**
 * Global listener — har sahifada AppShell ichida ishlaydi. Aparatdan noma'lum
 * employeeNo bilan event kelganda (DB'da person yo'q) sonner toast ko'rsatadi
 * va "Bazaga qo'shish" tugmasi taqdim etadi.
 *
 * Tugma bosilganda `importFromDevice` chaqirilib, agent'dan to'liq UserInfo
 * olinadi va DB'ga yoziladi.
 *
 * Toast deduplication: bir xil employeeNo har 60s'da bir martagina ko'rsatiladi.
 */
const recentToasts = new Map<string, number>();
const DEDUP_MS = 60_000;

export function UnknownPersonListener() {
  const importMut = useImportFromDevice();

  useUnknownPersonSocket((p: UnknownPersonPayload) => {
    const key = `${p.deviceId}:${p.employeeNo}`;
    const last = recentToasts.get(key) ?? 0;
    if (Date.now() - last < DEDUP_MS) return;
    recentToasts.set(key, Date.now());

    const title = p.personName
      ? `Yangi shaxs: ${p.personName}`
      : `Noma'lum shaxs (#${p.employeeNo})`;

    toast(title, {
      description: `${p.deviceName ?? 'Aparat'} orqali kirdi. DB'da yo'q — qo'shasizmi?`,
      duration: 12_000,
      icon: <UserPlus className="h-5 w-5" />,
      action: {
        label: 'Bazaga qo\'shish',
        onClick: () => {
          importMut.mutate(
            { deviceId: p.deviceId, employeeNos: [p.employeeNo] },
            {
              onSuccess: (res) => {
                if (res.created.length) {
                  toast.success(
                    `Hodim qo'shildi: ${res.created[0].name}`,
                  );
                } else if (res.skipped.length) {
                  toast.warning(res.skipped[0].reason);
                }
              },
              onError: (e) => toast.error(getApiErrorMessage(e)),
            },
          );
        },
      },
    });
  });

  return null;
}
