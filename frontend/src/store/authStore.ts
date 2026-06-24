import { create } from 'zustand';
import { authApi, type UserInfo } from '../api/auth';

interface AuthState {
  user: UserInfo | null;
  token: string;
  isLoggedIn: boolean;
  isAdmin: boolean;
  canManageUsers: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

function roleFromUser(user: UserInfo | null) {
  return {
    isAdmin: user?.role === 'admin',
    canManageUsers: user?.role === 'admin' || user?.role === 'manager',
  };
}

const savedUser = JSON.parse(localStorage.getItem('user') || 'null');

export const useAuthStore = create<AuthState>((set) => ({
  user: savedUser,
  token: localStorage.getItem('token') || '',
  isLoggedIn: !!localStorage.getItem('token'),
  ...roleFromUser(savedUser),

  login: async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    const { access_token, user_id, real_name, role } = res.data;
    const user: UserInfo = {
      id: user_id,
      username,
      real_name,
      role,
      is_active: true,
    };
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token: access_token, isLoggedIn: true, ...roleFromUser(user) });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: '', isLoggedIn: false, isAdmin: false, canManageUsers: false });
  },

  restoreSession: () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    set({ token: token || '', user, isLoggedIn: !!token, ...roleFromUser(user) });
  },
}));
