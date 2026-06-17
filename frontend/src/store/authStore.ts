import { create } from 'zustand';
import { authApi, type UserInfo } from '../api/auth';

interface AuthState {
  user: UserInfo | null;
  token: string;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || '',
  isLoggedIn: !!localStorage.getItem('token'),

  login: async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    const { access_token, user_id, real_name, role } = res.data;
    const user: UserInfo = {
      id: user_id,
      username,
      real_name,
      role,
    };
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token: access_token, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: '', isLoggedIn: false });
  },

  restoreSession: () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    set({ token: token || '', user, isLoggedIn: !!token });
  },
}));
