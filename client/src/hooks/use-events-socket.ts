import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AccessEvent } from '@/api/types';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const NAMESPACE_URL = `${API_BASE}/events`;

export function useEventsSocket(onEvent: (event: AccessEvent & { deviceName?: string }) => void) {
  const token = useAuthStore((s) => s.token);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(NAMESPACE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('access:event', (payload: AccessEvent & { deviceName?: string }) => {
      onEventRef.current(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token]);

  return { connected };
}
