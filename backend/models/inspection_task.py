from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class TaskStatus(str, enum.Enum):
    PENDING = "pending"          # 待巡检
    IN_PROGRESS = "in_progress"  # 进行中
    SUBMITTED = "submitted"      # 待审核
    COMPLETED = "completed"      # 已巡检
    REJECTED = "rejected"        # 已驳回
    CANCELLED = "cancelled"      # 已取消
    SUSPENDED = "suspended"      # 已挂起


class InspectionType(str, enum.Enum):
    FULL_LINE = "full_line"         # 一线一档巡视
    PERIODIC = "periodic"           # 周期型计划巡视
    SPECIAL = "special"             # 特殊巡视
    WORK_ORDER = "work_order"       # 工单巡视


class DefectSource(str, enum.Enum):
    AI = "ai"
    MANUAL = "manual"
    CORRECTED = "corrected"
    REMOVED = "removed"


class InspectionTask(Base):
    """巡检任务"""
    __tablename__ = "inspection_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_no = Column(String(50), unique=True, nullable=False, index=True)
    inspection_type = Column(SQLEnum(InspectionType), default=InspectionType.PERIODIC)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    inspector_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"))
    inspection_date = Column(String(20))
    location_province = Column(String(50))
    location_city = Column(String(50))
    location_district = Column(String(50))
    location_street = Column(String(100))
    longitude = Column(String(30))
    latitude = Column(String(30))
    customer_name = Column(String(200))
    priority = Column(Integer, default=2)  # 1=危急, 2=严重, 3=一般
    suspend_reason = Column(Text)
    cancel_reason = Column(Text)
    reject_reason = Column(Text)
    started_at = Column(DateTime)
    submitted_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    equipment = relationship("Equipment", back_populates="inspection_tasks")
    inspector = relationship("User", foreign_keys="InspectionTask.inspector_id", back_populates="inspection_tasks")
    reviewer = relationship("User", foreign_keys="InspectionTask.reviewer_id", back_populates="reviewed_tasks")
    photos = relationship("TaskPhoto", back_populates="task", order_by="TaskPhoto.taken_at")
    defects = relationship("TaskDefect", back_populates="task")


class TaskPhoto(Base):
    """巡检照片"""
    __tablename__ = "task_photos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    photo_type = Column(String(20), default="general")  # pole_number, panorama, closeup, general
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500))
    gps_latitude = Column(Float)
    gps_longitude = Column(Float)
    taken_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("InspectionTask", back_populates="photos")


class TaskDefect(Base):
    """巡检发现的缺陷"""
    __tablename__ = "task_defects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("inspection_tasks.id"), nullable=False)
    defect_type = Column(String(100))  # 缺陷类型
    defect_name = Column(String(200))  # 缺陷名称
    severity = Column(Integer, default=2)  # 1=危急, 2=严重, 3=一般
    confidence = Column(Float)  # AI置信度 0-1
    source = Column(SQLEnum(DefectSource), default=DefectSource.MANUAL)  # 来源
    description = Column(Text)
    position_x = Column(Float)  # 照片中位置X
    position_y = Column(Float)  # 照片中位置Y
    is_emergency = Column(String(5), default="false")  # 是否紧急抢修
    photo_id = Column(Integer, ForeignKey("task_photos.id"))
    ai_raw_result = Column(JSON)  # AI原始结果存档
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("InspectionTask", back_populates="defects")
    defect_order = relationship("DefectOrder", back_populates="task_defect", uselist=False)


class InspectionStrategy(Base):
    """巡检策略"""
    __tablename__ = "inspection_strategies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    equipment_type = Column(String(50))
    frequency_type = Column(String(10))  # daily, weekly, monthly, yearly
    frequency_value = Column(Integer, default=1)
    skip_holidays = Column(String(5), default="false")
    required_photos = Column(JSON)  # 必拍照片类型列表
    is_active = Column(String(5), default="true")
