from datetime import datetime
from sqlalchemy.orm import Session
from models.defect_order import DefectOrder, DefectOrderStatus
from schemas.defect_order import DefectOrderUpdate


def get_defect_orders(db: Session, skip: int = 0, limit: int = 20,
                      status: str = None, severity: int = None,
                      is_emergency: str = None, keyword: str = None):
    query = db.query(DefectOrder)
    if status:
        query = query.filter(DefectOrder.status == status)
    if severity:
        query = query.filter(DefectOrder.severity == severity)
    if is_emergency:
        query = query.filter(DefectOrder.is_emergency == is_emergency)
    if keyword:
        query = query.filter(DefectOrder.order_no.contains(keyword))

    total = query.count()
    items = query.order_by(
        DefectOrder.is_emergency.desc(),
        DefectOrder.severity.asc(),
        DefectOrder.created_at.desc()
    ).offset(skip).limit(limit).all()
    return total, items


def get_defect_order(db: Session, order_id: int):
    return db.query(DefectOrder).filter(DefectOrder.id == order_id).first()


def update_defect_order(db: Session, order_id: int, data: DefectOrderUpdate):
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    if data.repairer_id is not None:
        order.repairer_id = data.repairer_id
        order.assigned_at = datetime.utcnow()
    if data.status == DefectOrderStatus.IN_PROGRESS:
        order.status = DefectOrderStatus.IN_PROGRESS
        order.started_at = datetime.utcnow()
    if data.description is not None:
        order.description = data.description
    db.commit()
    db.refresh(order)
    return order


def complete_defect_order(db: Session, order_id: int, status: str, after_photo: str = None):
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    order.status = status
    order.completed_at = datetime.utcnow()
    if after_photo:
        order.after_photo_path = after_photo
    db.commit()
    db.refresh(order)
    return order


def cancel_defect_order(db: Session, order_id: int):
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    order.status = DefectOrderStatus.CANCELLED
    order.cancelled_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


def get_dashboard_stats(db: Session):
    from models.equipment import Equipment
    from models.inspection_task import InspectionTask, TaskStatus
    from models.defect_order import DefectOrder

    total_equipment = db.query(Equipment).count()
    total_tasks = db.query(InspectionTask).count()
    pending_tasks = db.query(InspectionTask).filter(InspectionTask.status == TaskStatus.PENDING).count()
    submitted_tasks = db.query(InspectionTask).filter(InspectionTask.status == TaskStatus.SUBMITTED).count()
    completed_tasks = db.query(InspectionTask).filter(InspectionTask.status == TaskStatus.COMPLETED).count()
    total_defects = db.query(DefectOrder).count()
    pending_defects = db.query(DefectOrder).filter(DefectOrder.status == DefectOrderStatus.PENDING).count()

    return {
        "total_equipment": total_equipment,
        "total_tasks": total_tasks,
        "pending_tasks": pending_tasks,
        "submitted_tasks": submitted_tasks,
        "completed_tasks": completed_tasks,
        "total_defects": total_defects,
        "pending_defects": pending_defects,
    }


def get_defect_distribution(db: Session):
    from models.defect_order import DefectOrder
    from sqlalchemy import func
    results = db.query(DefectOrder.defect_name, func.count(DefectOrder.id)).group_by(DefectOrder.defect_name).all()
    return [{"name": r[0] or "未分类", "value": r[1]} for r in results]
