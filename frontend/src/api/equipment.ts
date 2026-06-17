import request from './request';

export interface EquipmentData {
  id?: number;
  category: string;
  equipment_type: string;
  asset_code?: string;
  equipment_name: string;
  cabinet_model?: string;
  factory_number?: string;
  line_name?: string;
  station_name?: string;
  operation_date?: string;
  manufacturer?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  address_detail?: string;
  longitude?: string;
  latitude?: string;
  customer_name?: string;
  remark?: string;
  extra_fields?: Record<string, any>;
}

export const equipmentApi = {
  list: (params?: any) => request.get('/api/equipment', { params }),
  get: (id: number) => request.get(`/api/equipment/${id}`),
  create: (data: EquipmentData) => request.post('/api/equipment', data),
  update: (id: number, data: EquipmentData) => request.put(`/api/equipment/${id}`, data),
  delete: (id: number) => request.delete(`/api/equipment/${id}`),
  uploadPhoto: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/equipment/upload-photo', formData);
  },
  getFieldConfigs: () => request.get('/api/equipment/field-configs'),
};
