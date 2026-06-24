from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Any
from datetime import datetime
from enum import Enum


def _coerce_value(v: Any) -> Any:
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, Enum):
        return v.value
    return v


class DefectOrderCreate(BaseModel):
    """手动创建消缺工单"""
    equipment_id: int
    defect_type: str
    defect_name: str
    severity: int = 2
    is_emergency: str = "false"
    description: Optional[str] = None


class DefectOrderUpdate(BaseModel):
    """更新工单基础信息（仅待处理状态）"""
    repairer_id: Optional[int] = None
    description: Optional[str] = None
    severity: Optional[int] = None


class AssignRequest(BaseModel):
    """派发请求"""
    repairer_id: int


class ProcessRequest(BaseModel):
    """处理工单请求"""
    process_status: str  # "fully_resolved" 或 "partially_resolved"
    process_description: str  # 处理说明（必填）
    after_photo_paths: Optional[list[str]] = None  # 处理后照片

    @field_validator("process_status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("fully_resolved", "partially_resolved"):
            raise ValueError("process_status 必须是 fully_resolved / partially_resolved")
        return v

    @field_validator("process_description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("处理说明不能为空")
        return v


class CancelRequest(BaseModel):
    """取消请求"""
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("取消原因不能为空")
        return v


class DefectOrderResponse(BaseModel):
    id: int
    order_no: str
    task_defect_id: Optional[int] = None
    status: str
    equipment_id: Optional[int] = None
    repairer_id: Optional[int] = None
    defect_type: Optional[str] = None
    defect_name: Optional[str] = None
    severity: int = 2
    is_emergency: str = "false"
    location_province: Optional[str] = None
    location_city: Optional[str] = None
    location_district: Optional[str] = None
    location_street: Optional[str] = None
    location_detail: Optional[str] = None
    longitude: Optional[str] = None
    latitude: Optional[str] = None
    customer_name: Optional[str] = None
    description: Optional[str] = None
    before_photo_path: Optional[str] = None
    after_photo_paths: Optional[list] = None
    process_description: Optional[str] = None
    inspector_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    repairer_name: Optional[str] = None
    equipment_name: Optional[str] = None
    equipment_type: Optional[str] = None
    cancel_reason: Optional[str] = None
    # 历史字段
    last_processed_date: Optional[str] = None
    last_processor_name: Optional[str] = None
    last_process_result: Optional[str] = None
    # 时间戳
    deadline: Optional[str] = None
    created_at: Optional[str] = None
    assigned_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    updated_at: Optional[str] = None
    # 版本
    version: int = 1
    # 计算字段
    overdue_days: Optional[int] = None
    # 权限标记
    can_assign: bool = False
    can_start: bool = False
    can_process: bool = False
    can_cancel: bool = False
    can_delete: bool = False

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def coerce_types(cls, data: Any) -> Any:
        if data is None:
            return data
        if isinstance(data, dict):
            result = {}
            for k, v in data.items():
                result[k] = _coerce_value(v)
            return result
        # ORM model instance - only include fields that exist on the model
        result = {}
        for k in cls.model_fields:
            if hasattr(data, k):
                result[k] = _coerce_value(getattr(data, k, None))
        return result


class DefectOrderListResponse(BaseModel):
    total: int
    items: list[DefectOrderResponse]


class OrderStatisticsResponse(BaseModel):
    total: int = 0
    pending_count: int = 0
    in_progress_count: int = 0
    fully_resolved_count: int = 0
    partially_resolved_count: int = 0
    overdue_count: int = 0
