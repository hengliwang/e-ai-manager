from sqlalchemy.orm import Session
from models.equipment import Equipment, EquipmentPhoto, AuditLog, FieldConfig
from models.inspection_task import InspectionTask, TaskPhoto, TaskDefect
from models.defect_order import DefectOrder
from schemas.equipment import EquipmentCreate, EquipmentUpdate, FieldConfigCreate, FieldConfigUpdate


def get_equipment_list(db: Session, skip: int = 0, limit: int = 20,
                       category: str = None, equipment_type: str = None,
                       keyword: str = None, customer_name: str = None):
    query = db.query(Equipment)
    if category:
        query = query.filter(Equipment.category == category)
    if equipment_type:
        query = query.filter(Equipment.equipment_type == equipment_type)
    if customer_name:
        query = query.filter(Equipment.customer_name == customer_name)
    if keyword:
        query = query.filter(
            (Equipment.equipment_name.contains(keyword)) |
            (Equipment.asset_code.contains(keyword)) |
            (Equipment.address_detail.contains(keyword))
        )
    total = query.count()
    items = query.order_by(Equipment.updated_at.desc()).offset(skip).limit(limit).all()
    return total, items


def get_equipment(db: Session, equipment_id: int):
    return db.query(Equipment).filter(Equipment.id == equipment_id).first()


def create_equipment(db: Session, data: EquipmentCreate, user_id: int):
    equipment = Equipment(**data.model_dump(), created_by=user_id)
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment


def update_equipment(db: Session, equipment_id: int, data: EquipmentUpdate, user_id: int):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        return None
    for key, new_val in data.model_dump(exclude_unset=True).items():
        old_val = getattr(equipment, key)
        if str(old_val) != str(new_val):
            audit = AuditLog(
                equipment_id=equipment_id,
                field_name=key,
                old_value=str(old_val) if old_val else None,
                new_value=str(new_val),
                modified_by=user_id
            )
            db.add(audit)
        setattr(equipment, key, new_val)
    db.commit()
    db.refresh(equipment)
    return equipment


def delete_equipment(db: Session, equipment_id: int):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        return None

    # 级联删除：找到该设备的所有巡检任务
    task_ids = db.query(InspectionTask.id).filter(InspectionTask.equipment_id == equipment_id).all()
    task_id_list = [t[0] for t in task_ids]

    if task_id_list:
        # 删除消缺工单（关联到任务缺陷）
        db.query(DefectOrder).filter(
            DefectOrder.task_defect_id.in_(
                db.query(TaskDefect.id).filter(TaskDefect.task_id.in_(task_id_list))
            )
        ).delete(synchronize_session=False)

        # 删除任务缺陷
        db.query(TaskDefect).filter(TaskDefect.task_id.in_(task_id_list)).delete(synchronize_session=False)

        # 删除任务照片
        db.query(TaskPhoto).filter(TaskPhoto.task_id.in_(task_id_list)).delete(synchronize_session=False)

        # 删除巡检任务
        db.query(InspectionTask).filter(InspectionTask.equipment_id == equipment_id).delete(synchronize_session=False)

    # 删除直接关联到该设备的消缺工单
    db.query(DefectOrder).filter(DefectOrder.equipment_id == equipment_id).delete(synchronize_session=False)

    # 删除审计日志
    db.query(AuditLog).filter(AuditLog.equipment_id == equipment_id).delete(synchronize_session=False)

    # 删除设备照片
    db.query(EquipmentPhoto).filter(EquipmentPhoto.equipment_id == equipment_id).delete(synchronize_session=False)

    # 删除设备
    db.delete(equipment)
    db.commit()
    return equipment


# ===== 字段配置管理 =====

def get_field_configs(db: Session, include_disabled: bool = False):
    query = db.query(FieldConfig)
    if not include_disabled:
        query = query.filter(FieldConfig.is_active == "active")
    return query.order_by(FieldConfig.sort_order).all()


def get_field_config(db: Session, config_id: int):
    return db.query(FieldConfig).filter(FieldConfig.id == config_id).first()


def create_field_config(db: Session, data: FieldConfigCreate):
    config = FieldConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_field_config(db: Session, config_id: int, data: FieldConfigUpdate):
    config = db.query(FieldConfig).filter(FieldConfig.id == config_id).first()
    if not config:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return config


def delete_field_config(db: Session, config_id: int):
    config = db.query(FieldConfig).filter(FieldConfig.id == config_id).first()
    if config:
        db.delete(config)
        db.commit()
    return config


def manage_field_options(db: Session, config_id: int, action: str, option: dict = None, old_value: str = None):
    """管理字段配置的选项列表: add, update, remove, toggle"""
    config = db.query(FieldConfig).filter(FieldConfig.id == config_id).first()
    if not config or config.options is None:
        return None

    options = config.options

    if action == "add":
        if option:
            options.append(option)
    elif action == "update":
        if old_value and option:
            for i, opt in enumerate(options):
                opt_val = opt["value"] if isinstance(opt, dict) else opt
                if opt_val == old_value:
                    options[i] = option
                    break
    elif action == "remove":
        if old_value:
            options = [o for o in options if (o["value"] if isinstance(o, dict) else o) != old_value]
    elif action == "toggle":
        if old_value:
            for opt in options:
                if isinstance(opt, dict) and opt.get("value") == old_value:
                    opt["active"] = not opt.get("active", True)
                    break

    config.options = options
    db.commit()
    db.refresh(config)
    return config
