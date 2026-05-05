import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const NAMESPACE_URL = `${API_BASE}/events`;

export interface UnknownPersonPayload {
  companyId: string | null;
  deviceId: string;
  deviceName?: string;
  employeeNo: string;
  personName: string | null;
  capturedAt: string;
  pictureUrl: string | null;
}

/**
 * Aparat orqali noma'lum employeeNo bilan event keldi (DB'da yo'q) →
 * server `unknown:person` event'ni emit qiladi. Bu hook listen qiladi va
 * callback'ga uzatadi (toast/banner uchun).
 *
 * Bitta socket bitta brauzer per session — events.gateway tomonidan
 * companyRoom yoki SUPER_ROOM bo'yicha filterlanadi.
 */
export function useUnknownPersonSocket(
  onUnknown: (payload: UnknownPersonPayload) => void,
): void {
  const token = useAuthStore((s) => s.token);
  const onRef = useRef(onUnknown);
  onRef.current = onUnknown;

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(NAMESPACE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('unknown:person', (payload: UnknownPersonPayload) => {
      onRef.current(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token]);
}
