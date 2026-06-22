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

export interface FieldOption {
  label: string;
  value: string;
  active: boolean;
}

export interface CascadeRule {
  field: string;
  mapping: Record<string, string[]>;
}

export interface VisibilityRule {
  field: string;
  value: string;
  action: 'show' | 'hide';
  operator?: string;
}

export interface RequiredRule {
  field: string;
  value: string;
  operator?: string;
}

export interface FieldConfig {
  id: number;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: string;
  options?: FieldOption[];
  max_length?: number;
  regex_pattern?: string;
  regex_hint?: string;
  min_value?: number;
  max_value?: number;
  decimal_places?: number;
  date_format?: string;
  default_value?: any;
  sort_order: number;
  is_active: string;
  parent_field_id?: number;
  visibility_rules?: VisibilityRule[];
  required_rules?: RequiredRule[];
  cascade_rules?: CascadeRule[];
}

export const equipmentApi = {
  list: (params?: any) => request.get('/api/equipment', { params }),
  get: (id: number) => request.get(`/api/equipment/${id}`),
  create: (data: EquipmentData) => request.post('/api/equipment', data),
  update: (id: number, data: EquipmentData) => request.put(`/api/equipment/${id}`, data),
  delete: (id: number) => request.delete(`/api/equipment/${id}`),
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/equipment/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // 字段配置管理
  getFieldConfigs: (includeDisabled?: boolean) =>
    request.get('/api/equipment/field-configs', { params: { include_disabled: includeDisabled || false } }),
  createFieldConfig: (data: any) =>
    request.post('/api/equipment/field-configs', data),
  updateFieldConfig: (id: number, data: any) =>
    request.put(`/api/equipment/field-configs/${id}`, data),
  deleteFieldConfig: (id: number) =>
    request.delete(`/api/equipment/field-configs/${id}`),
  manageOptions: (configId: number, data: { action: string; option?: FieldOption; old_value?: string }) =>
    request.post(`/api/equipment/field-configs/${configId}/options`, data),

  // 导入导出
  export: () => request.get('/api/equipment/export', { responseType: 'blob' }),
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request.post('/api/equipment/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
