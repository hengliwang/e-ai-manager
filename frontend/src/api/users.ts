import request from './request';

export interface UserData {
  id: number;
  username: string;
  real_name: string;
  role: string;
  employee_id?: string;
  phone?: string;
  account_type: string;
  department?: string;
  region?: string;
  is_active: boolean;
  created_at?: string;
}

export interface CreateUserData {
  username: string;
  password: string;
  real_name: string;
  role: string;
  employee_id?: string;
  phone?: string;
  account_type: string;
  department?: string;
  region?: string;
}

export interface UpdateUserData {
  real_name?: string;
  role?: string;
  employee_id?: string;
  phone?: string;
  account_type?: string;
  department?: string;
  region?: string;
  is_active?: boolean;
}

export const usersApi = {
  list: (params?: {
    skip?: number;
    limit?: number;
    keyword?: string;
    role?: string;
    is_active?: boolean;
  }) => request.get('/api/users', { params }),

  getById: (id: number) => request.get(`/api/users/${id}`),

  create: (data: CreateUserData) => request.post('/api/users', data),

  update: (id: number, data: UpdateUserData) => request.put(`/api/users/${id}`, data),

  delete: (id: number) => request.delete(`/api/users/${id}`),

  resetPassword: (id: number, password: string) =>
    request.put(`/api/users/${id}/password`, { password }),

  toggleStatus: (id: number) => request.put(`/api/users/${id}/toggle-status`),
};
