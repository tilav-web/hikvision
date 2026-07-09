import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Bir vaqtda ko'p 401 bo'lsa faqat bitta refresh so'rovi ketadi (single-flight).
let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = useAuthStore.getState().refreshToken;
  if (!rt) return null;
  try {
    // Xom axios — `api` interceptor'ini chetlab o'tadi (cheksiz loop bo'lmasin).
    const { data } = await axios.post<{
      accessToken: string;
      refreshToken: string;
    }>(`${API_BASE}/api/auth/refresh`, { refreshToken: rt });
    useAuthStore.getState().setToken(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as
      | (AxiosError['config'] & { _retry?: boolean })
      | undefined;
    const store = useAuthStore.getState();

    // Faqat mavjud sessiya 401 qaytarsa (login 401'ida token yo'q — teginmaymiz).
    if (err.response?.status === 401 && store.token) {
      if (original && !original._retry && store.refreshToken) {
        original._retry = true;
        if (!refreshPromise) {
          refreshPromise = tryRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        if (newToken) {
          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
          return api(original); // asl so'rovni yangi token bilan qayta yuboramiz
        }
      }
      // Refresh yo'q yoki muvaffaqiyatsiz — sessiyani yopamiz.
      store.logout();
    }
    return Promise.reject(err);
  },
);

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Noma\'lum xato';
}
