from sqlalchemy.orm import Session
from models.equipment import Equipment, EquipmentPhoto, AuditLog, FieldConfig
from schemas.equipment import EquipmentCreate, EquipmentUpdate


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
    # 记录变更日志
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
    if equipment:
        db.delete(equipment)
        db.commit()
    return equipment


def get_field_configs(db: Session):
    return db.query(FieldConfig).filter(FieldConfig.is_active == "active").order_by(FieldConfig.sort_order).all()


def create_field_config(db: Session, data):
    config = FieldConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return config
