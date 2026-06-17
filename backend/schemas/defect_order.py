from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DefectOrderResponse(BaseModel):
    id: int
    order_no: str
    task_defect_id: int
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
    location_detail: Optional[str] = None
    description: Optional[str] = None
    before_photo_path: Optional[str] = None
    after_photo_path: Optional[str] = None
    inspector_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DefectOrderUpdate(BaseModel):
    repairer_id: Optional[int] = None
    status: Optional[str] = None
    description: Optional[str] = None


class DefectOrderListResponse(BaseModel):
    total: int
    items: list[DefectOrderResponse]
