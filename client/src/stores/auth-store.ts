import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/providers/query-provider';

export type UserRole = 'super_admin' | 'company_admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser, refreshToken?: string | null) => void;
  /** Faqat access token'ni yangilash (refresh oqimida). */
  setToken: (token: string, refreshToken?: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      setAuth: (token, user, refreshToken) =>
        set({
          token,
          user,
          refreshToken: refreshToken ?? get().refreshToken ?? null,
        }),
      setToken: (token, refreshToken) =>
        set({ token, refreshToken: refreshToken ?? get().refreshToken ?? null }),
      logout: () => {
        // Server tomonda access + refresh'ni bekor qilish (best-effort).
        const { token, refreshToken } = get();
        if (token) {
          const base = import.meta.env.VITE_API_URL ?? '';
          void fetch(`${base}/api/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
          }).catch(() => undefined);
        }
        set({ token: null, user: null, refreshToken: null });
        // Keshni to'liq tozalash — avvalgi foydalanuvchi/kompaniya ma'lumoti
        // yangi sessiyaga sizib o'tmasligi uchun.
        queryClient.clear();
      },
    }),
    {
      name: 'hikvision-auth',
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
