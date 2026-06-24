import request from './request';

export interface InspectionTask {
  id: number;
  task_no: string;
  inspection_type: string;
  status: string;
  audit_status?: string;
  equipment_id: number;
  inspector_id?: number;
  reviewer_id?: number;
  inspection_date?: string;
  line_name?: string;
  station_name?: string;
  location_province?: string;
  location_city?: string;
  location_district?: string;
  location_street?: string;
  address_detail?: string;
  longitude?: string;
  latitude?: string;
  customer_name?: string;
  priority: number;
  suspend_reason?: string;
  cancel_reason?: string;
  reject_reason?: string;
  created_at?: string;
  equipment_name?: string;
  equipment_type?: string;
  category?: string;
  inspector_name?: string;
  reviewer_name?: string;
  defect_count: number;
  can_accept: boolean;
  can_edit: boolean;
  can_cancel: boolean;
  can_suspend: boolean;
  can_resume: boolean;
  can_delete: boolean;
  can_review: boolean;
  can_resubmit: boolean;
  version: number;
  last_inspection_date?: string;
  last_inspector_name?: string;
  last_defect_summary?: string;
}

export interface TaskStatistics {
  total: number;
  pending_count: number;
  in_progress_count: number;
  submitted_count: number;
  completed_count: number;
  suspended_count: number;
}

export const inspectionApi = {
  list: (params?: any) => request.get('/api/inspection-tasks', { params }),
  get: (id: number) => request.get(`/api/inspection-tasks/${id}`),
  getStatistics: () => request.get('/api/inspection-tasks/statistics'),
  create: (data: any) => request.post('/api/inspection-tasks', data),
  update: (id: number, data: any) => request.put(`/api/inspection-tasks/${id}`, data),
  delete: (id: number) => request.delete(`/api/inspection-tasks/${id}`),
  start: (id: number) => request.post(`/api/inspection-tasks/${id}/start`),
  submit: (id: number, data: any) => request.post(`/api/inspection-tasks/${id}/submit`, data),
  review: (id: number, data: any) => request.post(`/api/inspection-tasks/${id}/review`, data),
  suspend: (id: number, reason: string) => request.post(`/api/inspection-tasks/${id}/suspend`, { reason }),
  resume: (id: number, reason: string, material?: string, expectedTime?: string) =>
    request.post(`/api/inspection-tasks/${id}/resume`, { reason, material, expected_time: expectedTime }),
  cancel: (id: number, reason: string) => request.post(`/api/inspection-tasks/${id}/cancel`, { reason }),
  resubmit: (id: number) => request.post(`/api/inspection-tasks/${id}/resubmit`),
  getDefects: (id: number) => request.get(`/api/inspection-tasks/${id}/defects`),
};
