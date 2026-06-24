import request from './request';

export interface DefectOrder {
  id: number;
  order_no: string;
  task_defect_id?: number;
  status: string;
  equipment_id?: number;
  repairer_id?: number;
  defect_type?: string;
  defect_name?: string;
  severity: number;
  is_emergency: string;
  location_province?: string;
  location_city?: string;
  location_district?: string;
  location_street?: string;
  location_detail?: string;
  longitude?: string;
  latitude?: string;
  customer_name?: string;
  description?: string;
  before_photo_path?: string;
  after_photo_paths?: string[];
  process_description?: string;
  inspector_name?: string;
  reviewer_name?: string;
  repairer_name?: string;
  equipment_name?: string;
  equipment_type?: string;
  cancel_reason?: string;
  last_processed_date?: string;
  last_processor_name?: string;
  last_process_result?: string;
  deadline?: string;
  created_at?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  version: number;
  overdue_days?: number;
  can_assign: boolean;
  can_start: boolean;
  can_process: boolean;
  can_cancel: boolean;
  can_delete: boolean;
}

export interface OrderStatistics {
  total: number;
  pending_count: number;
  in_progress_count: number;
  fully_resolved_count: number;
  partially_resolved_count: number;
  overdue_count: number;
}

export const defectApi = {
  list: (params?: any) => request.get('/api/defect-orders', { params }),
  get: (id: number) => request.get(`/api/defect-orders/${id}`),
  getStatistics: () => request.get('/api/defect-orders/statistics'),
  create: (data: any) => request.post('/api/defect-orders', data),
  update: (id: number, data: any) => request.put(`/api/defect-orders/${id}`, data),
  delete: (id: number) => request.delete(`/api/defect-orders/${id}`),
  assign: (id: number, repairer_id: number) =>
    request.post(`/api/defect-orders/${id}/assign`, { repairer_id }),
  process: (id: number, data: { process_status: string; process_description: string; after_photo_paths?: string[] }) =>
    request.post(`/api/defect-orders/${id}/process`, data),
  cancel: (id: number, reason: string) =>
    request.post(`/api/defect-orders/${id}/cancel`, { reason }),
};

export const dashboardApi = {
  getStats: () => request.get('/api/dashboard/stats'),
  getDefectDistribution: () => request.get('/api/dashboard/defect-distribution'),
};
