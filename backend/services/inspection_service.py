from datetime import datetime
from sqlalchemy.orm import Session
from models.inspection_task import InspectionTask, TaskPhoto, TaskDefect, DefectSource, TaskStatus, InspectionType
from models.defect_order import DefectOrder, DefectOrderStatus
from schemas.inspection_task import InspectionTaskCreate, SubmitInspectionRequest, ReviewRequest
from models.user import UserRole


TASK_NO_SEQ = 1000


def generate_task_no(db: Session) -> str:
    global TASK_NO_SEQ
    today = datetime.utcnow().strftime("%Y%m%d")
    TASK_NO_SEQ += 1
    return f"INSP{today}{TASK_NO_SEQ:04d}"


def generate_order_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    count = db.query(DefectOrder).count() + 1
    return f"DEF{today}{count:04d}"


def get_inspection_tasks(db: Session, skip: int = 0, limit: int = 20,
                         status: str = None, inspector_id: int = None,
                         inspection_type: str = None, keyword: str = None,
                         current_user=None):
    query = db.query(InspectionTask)
    if status:
        query = query.filter(InspectionTask.status == status)
    if inspector_id:
        query = query.filter(InspectionTask.inspector_id == inspector_id)
    if inspection_type:
        query = query.filter(InspectionTask.inspection_type == inspection_type)
    # 一线巡检员只能看到被指派给自己的任务
    if current_user and current_user.role == UserRole.INSPECTOR:
        query = query.filter(InspectionTask.inspector_id == current_user.id)
    if keyword:
        query = query.join(InspectionTask.equipment).filter(
            InspectionTask.task_no.contains(keyword)
        )

    total = query.count()
    items = query.order_by(
        InspectionTask.priority.asc(),
        InspectionTask.created_at.desc()
    ).offset(skip).limit(limit).all()

    # 附加关联数据
    for item in items:
        item.equipment_name = item.equipment.equipment_name if item.equipment else None
        item.equipment_type = item.equipment.equipment_type if item.equipment else None
        item.category = item.equipment.category if item.equipment else None
        item.inspector_name = item.inspector.real_name if item.inspector else None
        item.defect_count = len(item.defects)

    return total, items


def get_inspection_task(db: Session, task_id: int):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task:
        task.equipment_name = task.equipment.equipment_name if task.equipment else None
        task.equipment_type = task.equipment.equipment_type if task.equipment else None
        task.category = task.equipment.category if task.equipment else None
        task.inspector_name = task.inspector.real_name if task.inspector else None
        task.defect_count = len(task.defects)
    return task


def create_inspection_task(db: Session, data: InspectionTaskCreate, user_id: int):
    task = InspectionTask(
        task_no=generate_task_no(db),
        inspection_type=data.inspection_type,
        equipment_id=data.equipment_id,
        inspector_id=data.inspector_id,
        inspection_date=data.inspection_date,
        priority=data.priority,
        created_by=user_id
    )
    # 从设备获取位置信息
    equipment = db.query(InspectionTask).get
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def start_task(db: Session, task_id: int):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task and task.status == TaskStatus.PENDING:
        task.status = TaskStatus.IN_PROGRESS
        task.started_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
    return task


def submit_inspection(db: Session, task_id: int, data: SubmitInspectionRequest):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None

    # 保存缺陷数据
    for photo_path in data.photos:
        task_photo = TaskPhoto(
            task_id=task_id,
            file_path=photo_path
        )
        db.add(task_photo)

    for defect in data.defects:
        task_defect = TaskDefect(
            task_id=task_id,
            defect_type=defect.defect_type,
            defect_name=defect.defect_name,
            severity=defect.severity,
            confidence=defect.confidence,
            source=DefectSource[defect.source.upper()] if defect.source else DefectSource.MANUAL,
            description=defect.description,
            is_emergency=defect.is_emergency
        )
        db.add(task_defect)

    task.status = TaskStatus.SUBMITTED
    task.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


def review_task(db: Session, task_id: int, data: ReviewRequest, user_id: int):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None

    task.reviewer_id = user_id

    if data.action == "approve":
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        # 自动生成消缺工单
        _generate_defect_orders(db, task)
    elif data.action == "reject":
        task.status = TaskStatus.REJECTED
        task.reject_reason = data.reason
    elif data.action == "correct":
        # 审核人修正缺陷
        if data.corrected_defects:
            for d in data.corrected_defects:
                defect = TaskDefect(
                    task_id=task_id,
                    defect_type=d.defect_type,
                    defect_name=d.defect_name,
                    severity=d.severity,
                    source=DefectSource.CORRECTED,
                    description=d.description,
                    is_emergency=d.is_emergency
                )
                db.add(defect)
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        _generate_defect_orders(db, task)

    db.commit()
    db.refresh(task)
    return task


def _generate_defect_orders(db: Session, task: InspectionTask):
    """巡检通过后，1:N拆解缺陷为消缺工单"""
    for defect in task.defects:
        order = DefectOrder(
            order_no=generate_order_no(db),
            task_defect_id=defect.id,
            status=DefectOrderStatus.PENDING,
            equipment_id=task.equipment_id,
            defect_type=defect.defect_type,
            defect_name=defect.defect_name,
            severity=defect.severity,
            is_emergency=defect.is_emergency,
            location_province=task.location_province,
            location_city=task.location_city,
            location_district=task.location_district,
            longitude=task.longitude,
            latitude=task.latitude,
            inspector_name=task.inspector.real_name if task.inspector else None,
            reviewer_name=task.reviewer.real_name if task.reviewer else None,
        )
        db.add(order)


def suspend_task(db: Session, task_id: int, reason: str):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task and task.status in [TaskStatus.PENDING, TaskStatus.IN_PROGRESS]:
        task.status = TaskStatus.SUSPENDED
        task.suspend_reason = reason
        db.commit()
        db.refresh(task)
    return task


def resume_task(db: Session, task_id: int):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task and task.status == TaskStatus.SUSPENDED:
        task.status = TaskStatus.PENDING
        task.suspend_reason = None
        db.commit()
        db.refresh(task)
    return task


def cancel_task(db: Session, task_id: int, reason: str):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task and task.status in [TaskStatus.PENDING, TaskStatus.SUSPENDED, TaskStatus.IN_PROGRESS]:
        task.status = TaskStatus.CANCELLED
        task.cancel_reason = reason
        task.cancelled_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
    return task


def get_task_defects(db: Session, task_id: int):
    return db.query(TaskDefect).filter(TaskDefect.task_id == task_id).all()
