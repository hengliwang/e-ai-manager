import request from './request';

export interface LoginData {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  role: string;
  phone?: string;
  department?: string;
  region?: string;
  is_active: boolean;
}

export const authApi = {
  login: (data: LoginData) => request.post('/api/auth/login', data),
  getMe: () => request.get('/api/auth/me'),
};
