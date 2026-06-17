from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class DefectOrderStatus(str, enum.Enum):
    PENDING = "pending"                # 待处理
    IN_PROGRESS = "in_progress"        # 处理中
    FULLY_RESOLVED = "fully_resolved"  # 已全部消除
    PARTIALLY_RESOLVED = "partially_resolved"  # 已部分消除
    CANCELLED = "cancelled"            # 已取消


class DefectOrder(Base):
    """消缺工单"""
    __tablename__ = "defect_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    task_defect_id = Column(Integer, ForeignKey("task_defects.id"), nullable=False)
    status = Column(SQLEnum(DefectOrderStatus), default=DefectOrderStatus.PENDING, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    repairer_id = Column(Integer, ForeignKey("users.id"))
    defect_type = Column(String(100))
    defect_name = Column(String(200))
    severity = Column(Integer, default=2)
    is_emergency = Column(String(5), default="false")
    location_province = Column(String(50))
    location_city = Column(String(50))
    location_district = Column(String(50))
    location_street = Column(String(100))
    location_detail = Column(String(255))
    longitude = Column(String(30))
    latitude = Column(String(30))
    description = Column(Text)
    before_photo_path = Column(String(500))  # 消缺前照片
    after_photo_path = Column(String(500))   # 消缺后照片
    inspector_name = Column(String(50))
    reviewer_name = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)

    task_defect = relationship("TaskDefect", back_populates="defect_order")
