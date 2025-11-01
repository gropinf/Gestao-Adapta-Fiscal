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
  setAuth: (user: User, token: string) => void;
  setCurrentCompany: (companyId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      currentCompanyId: null,
      setAuth: (user, token) => set({ user, token }),
      setCurrentCompany: (companyId) => set({ currentCompanyId: companyId }),
      logout: () => set({ user: null, token: null, currentCompanyId: null }),
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
