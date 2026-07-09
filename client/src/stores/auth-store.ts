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
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        set({ token: null, user: null });
        // Keshni to'liq tozalash — avvalgi foydalanuvchi/kompaniya ma'lumoti
        // yangi sessiyaga sizib o'tmasligi uchun.
        queryClient.clear();
      },
    }),
    {
      name: 'hikvision-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    },
  ),
);
