from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class FieldConfigCreate(BaseModel):
    field_name: str
    field_label: str
    field_type: str
    is_required: str = "optional"
    options: Optional[list] = None
    max_length: Optional[int] = None
    regex_pattern: Optional[str] = None
    regex_hint: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    decimal_places: Optional[int] = None
    date_format: Optional[str] = None
    default_value: Optional[Any] = None
    sort_order: int = 0
    parent_field_id: Optional[int] = None
    visibility_rules: Optional[list] = None
    required_rules: Optional[list] = None
    cascade_rules: Optional[list] = None


class FieldConfigUpdate(BaseModel):
    field_name: Optional[str] = None
    field_label: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[str] = None
    options: Optional[list] = None
    max_length: Optional[int] = None
    regex_pattern: Optional[str] = None
    regex_hint: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    decimal_places: Optional[int] = None
    date_format: Optional[str] = None
    default_value: Optional[Any] = None
    sort_order: Optional[int] = None
    is_active: Optional[str] = None
    parent_field_id: Optional[int] = None
    visibility_rules: Optional[list] = None
    required_rules: Optional[list] = None
    cascade_rules: Optional[list] = None


class FieldConfigResponse(BaseModel):
    id: int
    field_name: str
    field_label: str
    field_type: str
    is_required: str
    options: Optional[list] = None
    max_length: Optional[int] = None
    regex_pattern: Optional[str] = None
    regex_hint: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    decimal_places: Optional[int] = None
    date_format: Optional[str] = None
    default_value: Optional[Any] = None
    sort_order: int
    is_active: str
    parent_field_id: Optional[int] = None
    visibility_rules: Optional[list] = None
    required_rules: Optional[list] = None
    cascade_rules: Optional[list] = None

    class Config:
        from_attributes = True


class OptionItem(BaseModel):
    """选项管理"""
    label: str
    value: str
    active: bool = True


class OptionManageRequest(BaseModel):
    """选项增删改请求"""
    action: str  # add, update, remove, toggle
    option: Optional[OptionItem] = None
    old_value: Optional[str] = None  # for update/remove, the value to find


class EquipmentCreate(BaseModel):
    category: str
    equipment_type: str
    asset_code: Optional[str] = None
    equipment_name: str
    cabinet_model: Optional[str] = None
    factory_number: Optional[str] = None
    line_name: Optional[str] = None
    station_name: Optional[str] = None
    operation_date: Optional[str] = None
    manufacturer: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    street: Optional[str] = None
    address_detail: Optional[str] = None
    longitude: Optional[str] = None
    latitude: Optional[str] = None
    customer_name: Optional[str] = None
    remark: Optional[str] = None
    extra_fields: Optional[dict] = None


class EquipmentUpdate(EquipmentCreate):
    pass


class EquipmentPhotoResponse(BaseModel):
    id: int
    photo_type: str
    file_path: str
    description: Optional[str] = None
    is_current: str
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    modified_at: datetime

    class Config:
        from_attributes = True


class EquipmentResponse(BaseModel):
    id: int
    category: str
    equipment_type: str
    asset_code: Optional[str] = None
    equipment_name: str
    cabinet_model: Optional[str] = None
    factory_number: Optional[str] = None
    line_name: Optional[str] = None
    station_name: Optional[str] = None
    operation_date: Optional[str] = None
    manufacturer: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    street: Optional[str] = None
    address_detail: Optional[str] = None
    longitude: Optional[str] = None
    latitude: Optional[str] = None
    customer_name: Optional[str] = None
    remark: Optional[str] = None
    extra_fields: Optional[dict] = None
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime
    photos: list[EquipmentPhotoResponse] = []
    audit_logs: list[AuditLogResponse] = []

    class Config:
        from_attributes = True


class EquipmentListResponse(BaseModel):
    total: int
    items: list[EquipmentResponse]
