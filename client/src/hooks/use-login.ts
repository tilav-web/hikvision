import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/auth-store';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', vars);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user, data.refreshToken);
    },
  });
}
