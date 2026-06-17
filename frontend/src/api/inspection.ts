import request from './request';

export const inspectionApi = {
  list: (params?: any) => request.get('/api/inspection-tasks', { params }),
  get: (id: number) => request.get(`/api/inspection-tasks/${id}`),
  create: (data: any) => request.post('/api/inspection-tasks', data),
  start: (id: number) => request.post(`/api/inspection-tasks/${id}/start`),
  submit: (id: number, data: any) => request.post(`/api/inspection-tasks/${id}/submit`, data),
  review: (id: number, data: any) => request.post(`/api/inspection-tasks/${id}/review`, data),
  suspend: (id: number, reason?: string) => request.post(`/api/inspection-tasks/${id}/suspend`, null, { params: { reason } }),
  resume: (id: number) => request.post(`/api/inspection-tasks/${id}/resume`),
  cancel: (id: number, reason?: string) => request.post(`/api/inspection-tasks/${id}/cancel`, null, { params: { reason } }),
  getDefects: (id: number) => request.get(`/api/inspection-tasks/${id}/defects`),
};
