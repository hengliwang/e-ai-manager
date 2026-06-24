from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class DefectOrderStatus(str, enum.Enum):
    PENDING = "pending"                    # 待处理
    IN_PROGRESS = "in_progress"            # 处理中
    FULLY_RESOLVED = "fully_resolved"      # 已全部消除
    PARTIALLY_RESOLVED = "partially_resolved"  # 已部分消除
    CANCELLED = "cancelled"                # 已取消


# 合法状态转换表
STATE_TRANSITIONS: dict = {
    DefectOrderStatus.PENDING:             [DefectOrderStatus.IN_PROGRESS, DefectOrderStatus.CANCELLED],
    DefectOrderStatus.IN_PROGRESS:         [DefectOrderStatus.FULLY_RESOLVED, DefectOrderStatus.PARTIALLY_RESOLVED, DefectOrderStatus.CANCELLED],
    DefectOrderStatus.PARTIALLY_RESOLVED:  [DefectOrderStatus.FULLY_RESOLVED, DefectOrderStatus.PARTIALLY_RESOLVED, DefectOrderStatus.CANCELLED],
    # FULLY_RESOLVED / CANCELLED 是终态，不能转换
}

STATUS_NAMES: dict = {
    DefectOrderStatus.PENDING: "待处理",
    DefectOrderStatus.IN_PROGRESS: "处理中",
    DefectOrderStatus.FULLY_RESOLVED: "已全部消除",
    DefectOrderStatus.PARTIALLY_RESOLVED: "已部分消除",
    DefectOrderStatus.CANCELLED: "已取消",
}


class DefectOrder(Base):
    """消缺工单"""
    __tablename__ = "defect_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_no = Column(String(50), unique=True, nullable=False, index=True)
    task_defect_id = Column(Integer, ForeignKey("task_defects.id"), nullable=True)  # 手动创建的工单无关联缺陷
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
    customer_name = Column(String(200))
    description = Column(Text)
    before_photo_path = Column(String(500))          # 消缺前照片（源缺陷照片）
    after_photo_paths = Column(JSON, default=list)   # 消缺后照片列表（多图）
    process_description = Column(Text)                # 处理说明（必填）
    inspector_name = Column(String(50))
    reviewer_name = Column(String(50))
    repairer_name = Column(String(50))                # 消缺处理人姓名（冗余）
    equipment_name = Column(String(200))              # 设备名称（冗余）
    equipment_type = Column(String(50))               # 设备类型（冗余）
    cancel_reason = Column(Text)                      # 取消原因
    # 历史处理字段
    last_processed_date = Column(DateTime)            # 最近一次处理日期
    last_processor_name = Column(String(50))          # 最近一次处理人
    last_process_result = Column(Text)                # 最近一次处理情况
    # 时间戳
    deadline = Column(DateTime)                       # SLA截止时间
    created_at = Column(DateTime, default=datetime.utcnow)
    assigned_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # 并发控制
    version = Column(Integer, default=1, nullable=False)

    task_defect = relationship("TaskDefect", back_populates="defect_order")
