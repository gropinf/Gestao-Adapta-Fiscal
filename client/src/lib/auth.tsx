import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  currentCompanyId: string | null;
  accessLogId: string | null;
  setAuth: (user: User, token: string, accessLogId?: string) => void;
  setCurrentCompany: (companyId: string) => void;
  setAccessLogId: (accessLogId: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentCompanyId: null,
      accessLogId: null,
      setAuth: (user, token, accessLogId) => set({ user, token, accessLogId: accessLogId || null }),
      setCurrentCompany: (companyId) => set({ currentCompanyId: companyId }),
      setAccessLogId: (accessLogId) => set({ accessLogId }),
      logout: () => set({ user: null, token: null, currentCompanyId: null, accessLogId: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
