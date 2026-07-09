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

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    // Faqat mavjud sessiya 401 qaytarsa logout qilamiz (login so'rovidagi
    // noto'g'ri parol 401'ida token yo'q — keraksiz logout bo'lmaydi).
    if (err.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().logout();
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
