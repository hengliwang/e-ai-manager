import request from './request';

export const defectApi = {
  list: (params?: any) => request.get('/api/defect-orders', { params }),
  get: (id: number) => request.get(`/api/defect-orders/${id}`),
  update: (id: number, data: any) => request.put(`/api/defect-orders/${id}`, data),
  complete: (id: number, status: string) => request.post(`/api/defect-orders/${id}/complete`, null, { params: { status } }),
  cancel: (id: number) => request.post(`/api/defect-orders/${id}/cancel`),
};

export const dashboardApi = {
  getStats: () => request.get('/api/dashboard/stats'),
  getDefectDistribution: () => request.get('/api/dashboard/defect-distribution'),
};
