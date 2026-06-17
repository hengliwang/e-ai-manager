from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


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


class InspectionTaskCreate(BaseModel):
    equipment_id: int
    inspector_id: int
    inspection_date: str
    inspection_type: str = "periodic"
    priority: int = 2


class InspectionTaskResponse(BaseModel):
    id: int
    task_no: str
    inspection_type: str
    status: str
    equipment_id: int
    inspector_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    inspection_date: Optional[str] = None
    location_province: Optional[str] = None
    location_city: Optional[str] = None
    location_district: Optional[str] = None
    customer_name: Optional[str] = None
    priority: int = 2
    cancel_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    equipment_name: Optional[str] = None
    equipment_type: Optional[str] = None
    category: Optional[str] = None
    inspector_name: Optional[str] = None
    defect_count: int = 0

    class Config:
        from_attributes = True


class InspectionTaskListResponse(BaseModel):
    total: int
    items: list[InspectionTaskResponse]
