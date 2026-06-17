from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class FieldConfig(Base):
    """设备档案字段配置"""
    __tablename__ = "field_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    field_name = Column(String(50), nullable=False)
    field_label = Column(String(100), nullable=False)
    field_type = Column(String(20), nullable=False)  # text, number, date, select, multi_select, image
    is_required = Column(String(10), default="optional")  # always, dynamic, optional
    options = Column(JSON)  # 下拉选项列表
    max_length = Column(Integer)
    regex_pattern = Column(String(255))
    min_value = Column(Integer)
    max_value = Column(Integer)
    decimal_places = Column(Integer)
    sort_order = Column(Integer, default=0)
    is_active = Column(String(10), default="active")  # active, disabled
    parent_field_id = Column(Integer, ForeignKey("field_configs.id"), nullable=True)  # 级联父字段
    visibility_rules = Column(JSON)  # 可见性联动规则
    required_rules = Column(JSON)  # 动态必填规则
    cascade_rules = Column(JSON)  # 选项联动规则
    created_at = Column(DateTime, default=datetime.utcnow)


class Equipment(Base):
    """设备档案"""
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(20), nullable=False, index=True)  # 土建类 / 电器类
    equipment_type = Column(String(50), nullable=False, index=True)  # 电线杆、变压器...
    asset_code = Column(String(100))  # 资产编码
    equipment_name = Column(String(200), nullable=False)
    cabinet_model = Column(String(100))
    factory_number = Column(String(100))
    line_name = Column(String(100))
    station_name = Column(String(100))
    operation_date = Column(String(20))
    manufacturer = Column(String(200))
    province = Column(String(50))
    city = Column(String(50))
    district = Column(String(50))
    street = Column(String(100))
    address_detail = Column(String(255))
    longitude = Column(String(30))
    latitude = Column(String(30))
    customer_name = Column(String(200))
    remark = Column(Text)
    extra_fields = Column(JSON)  # 动态扩展字段
    photo_count = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    photos = relationship("EquipmentPhoto", back_populates="equipment", order_by="EquipmentPhoto.created_at.desc()")
    inspection_tasks = relationship("InspectionTask", back_populates="equipment")
    audit_logs = relationship("AuditLog", back_populates="equipment")


class EquipmentPhoto(Base):
    """设备照片"""
    __tablename__ = "equipment_photos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    photo_type = Column(String(20), default="general")  # panorama, nameplate, closeup, general
    file_path = Column(String(500), nullable=False)
    description = Column(String(255))
    is_current = Column(String(5), default="false")  # 是否为主图
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    equipment = relationship("Equipment", back_populates="photos")


class AuditLog(Base):
    """变更审计日志"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    modified_by = Column(Integer, ForeignKey("users.id"))
    modified_at = Column(DateTime, default=datetime.utcnow)

    equipment = relationship("Equipment", back_populates="audit_logs")
