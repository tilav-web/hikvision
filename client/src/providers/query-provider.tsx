import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Singleton — logout/401 paytida keshni tozalash uchun tashqaridan ham
 * chaqiriladi (auth-store, api interceptor). Bu kompaniyalararo ma'lumot
 * oqishini oldini oladi (bir brauzerda boshqa admin kirsa).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
