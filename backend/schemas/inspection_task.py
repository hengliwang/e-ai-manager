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


class DefectItem(BaseModel):
    defect_type: str
    defect_name: str
    severity: int = 2
    confidence: Optional[float] = None
    source: str = "manual"
    description: Optional[str] = None
    is_emergency: str = "false"


class SubmitInspectionRequest(BaseModel):
    defects: list[DefectItem] = []
    photos: list[str] = []


class ReviewRequest(BaseModel):
    action: str  # approve, reject, correct
    reason: Optional[str] = None
    corrected_defects: Optional[list[DefectItem]] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        if v not in ("approve", "reject", "correct"):
            raise ValueError("action 必须是 approve / reject / correct")
        return v


class InspectionTaskCreate(BaseModel):
    equipment_id: int
    inspector_id: int
    inspection_date: str
    inspection_type: str = "periodic"
    priority: int = 2


class InspectionTaskUpdate(BaseModel):
    """编辑任务基础信息（仅待巡检/挂起状态可编辑）"""
    inspection_date: Optional[str] = None
    inspector_id: Optional[int] = None
    priority: Optional[int] = None


class CancelRequest(BaseModel):
    reason: str  # 取消原因（必填）

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("取消原因不能为空")
        return v


class SuspendRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("挂起原因不能为空")
        return v


class ResumeRequest(BaseModel):
    reason: str
    material: Optional[str] = None  # 佐证材料路径
    expected_time: Optional[str] = None  # 预计执行时间


class InspectionTaskResponse(BaseModel):
    id: int
    task_no: str
    inspection_type: str
    status: str
    audit_status: Optional[str] = None
    equipment_id: int
    inspector_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    inspection_date: Optional[str] = None
    line_name: Optional[str] = None
    station_name: Optional[str] = None
    location_province: Optional[str] = None
    location_city: Optional[str] = None
    location_district: Optional[str] = None
    location_street: Optional[str] = None
    address_detail: Optional[str] = None
    longitude: Optional[str] = None
    latitude: Optional[str] = None
    customer_name: Optional[str] = None
    priority: int = 2
    suspend_reason: Optional[str] = None
    cancel_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    started_at: Optional[str] = None
    submitted_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[int] = None
    equipment_name: Optional[str] = None
    equipment_type: Optional[str] = None
    category: Optional[str] = None
    inspector_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    defect_count: int = 0
    can_accept: bool = False
    can_edit: bool = False
    can_cancel: bool = False
    can_suspend: bool = False
    can_resume: bool = False
    can_delete: bool = False
    can_review: bool = False
    can_resubmit: bool = False
    version: int = 1
    # 历史字段
    last_inspection_date: Optional[str] = None
    last_inspector_name: Optional[str] = None
    last_defect_summary: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def coerce_types(cls, data: Any) -> Any:
        if data is None:
            return data
        if isinstance(data, dict):
            return {k: _coerce_value(v) for k, v in data.items()}
        # ORM model instance
        return {k: _coerce_value(getattr(data, k, None)) for k in cls.model_fields}


class TaskStatisticsResponse(BaseModel):
    total: int = 0
    pending_count: int = 0
    in_progress_count: int = 0
    submitted_count: int = 0
    completed_count: int = 0
    suspended_count: int = 0


class InspectionTaskListResponse(BaseModel):
    total: int
    items: list[InspectionTaskResponse]
