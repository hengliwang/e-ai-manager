from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from models.inspection_task import InspectionTask, TaskPhoto, TaskDefect, DefectSource, TaskStatus, AuditStatus, InspectionType
from models.equipment import Equipment
from models.defect_order import DefectOrder, DefectOrderStatus
from schemas.inspection_task import InspectionTaskCreate
from models.user import UserRole

TASK_NO_SEQ = 1000

# ============================================================
# 7 状态机定义
#
#   待巡检(PENDING) ──start──▶ 进行中(IN_PROGRESS)
#       │                          │
#       │                          ├──submit──▶ 待审核(SUBMITTED)
#       │                          │                │
#       │                          │           ┌────┴────┐
#       │                          │      approve    reject
#       │                          │           │        │
#       │                          │     已巡检(COMPLETED) 已驳回(REJECTED)
#       │                          │                    │
#       │                          │               resubmit
#       │                          │                    │
#       │                          │                    ▼
#       │                          │              待巡检(PENDING)
#       │                          │
#       │                    ┌─────┴─────┐
#       │               suspend      cancel
#       │                    │           │
#       │                    ▼           ▼
#       │              已挂起(SUSPENDED) 已取消(CANCELLED)
#       │                    │
#       │               resume/cancel
#       │                    │
#       │               ┌────┴────┐
#       │               ▼         ▼
#       │         待巡检(PENDING) 已取消(CANCELLED)
#       │
#       └──cancel──▶ 已取消(CANCELLED)
#       └──suspend──▶ 已挂起(SUSPENDED)
# ============================================================

# 合法状态转换表
STATE_TRANSITIONS: dict = {
    TaskStatus.PENDING:      [TaskStatus.IN_PROGRESS, TaskStatus.SUSPENDED, TaskStatus.CANCELLED],
    TaskStatus.IN_PROGRESS:  [TaskStatus.SUBMITTED, TaskStatus.SUSPENDED, TaskStatus.CANCELLED],
    TaskStatus.SUBMITTED:    [TaskStatus.COMPLETED, TaskStatus.REJECTED],
    TaskStatus.REJECTED:     [TaskStatus.PENDING],   # 重新派发
    TaskStatus.SUSPENDED:    [TaskStatus.PENDING, TaskStatus.CANCELLED],
    # COMPLETED / CANCELLED 是终态，不能转换
}

# 中文状态名
STATUS_NAMES: dict = {
    TaskStatus.PENDING: "待巡检",
    TaskStatus.IN_PROGRESS: "进行中",
    TaskStatus.SUBMITTED: "待审核",
    TaskStatus.COMPLETED: "已巡检",
    TaskStatus.REJECTED: "已驳回",
    TaskStatus.CANCELLED: "已取消",
    TaskStatus.SUSPENDED: "已挂起",
}


class StateTransitionError(Exception):
    """状态流转异常"""
    def __init__(self, current: TaskStatus, target: TaskStatus, detail: str = ""):
        cur_name = STATUS_NAMES.get(current, current.value)
        tar_name = STATUS_NAMES.get(target, target.value)
        msg = f"不允许从「{cur_name}」转为「{tar_name}」"
        if detail:
            msg += f"：{detail}"
        super().__init__(msg)
        self.current = current
        self.target = target
        self.detail = detail


class ConcurrencyError(Exception):
    """并发冲突异常"""
    def __init__(self, task_id: int):
        super().__init__(f"任务 #{task_id} 已被其他操作修改，请刷新后重试")


def _validate_transition(task: InspectionTask, target: TaskStatus) -> None:
    """校验状态流转是否合法"""
    current = task.status
    if isinstance(current, str):
        current = TaskStatus(current)
    if isinstance(target, str):
        target = TaskStatus(target)

    allowed = STATE_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise StateTransitionError(current, target)


def _check_version(task: InspectionTask, expected_version: Optional[int]) -> None:
    """乐观锁校验"""
    if expected_version is not None and task.version != expected_version:
        raise ConcurrencyError(task.id)


def _bump_version(task: InspectionTask) -> None:
    """递增版本号"""
    task.version = (task.version or 0) + 1


# ============================================================
# 工具函数
# ============================================================

def generate_task_no(db: Session) -> str:
    global TASK_NO_SEQ
    today = datetime.utcnow().strftime("%Y%m%d")
    TASK_NO_SEQ += 1
    return f"INSP{today}{TASK_NO_SEQ:04d}"


def generate_order_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    count = db.query(DefectOrder).count() + 1
    return f"DEF{today}{count:04d}"


def _attach_extra_fields(task: InspectionTask, current_user=None, db: Session = None):
    """附加关联数据 + 权限标记 + 历史字段"""
    if task.equipment:
        task.equipment_name = task.equipment.equipment_name
        task.equipment_type = task.equipment.equipment_type
        task.category = task.equipment.category
    task.inspector_name = task.inspector.real_name if task.inspector else None
    task.reviewer_name = task.reviewer.real_name if task.reviewer else None
    task.defect_count = len(task.defects)

    # 历史字段：同设备最近一次已巡检记录
    task.last_inspection_date = None
    task.last_inspector_name = None
    task.last_defect_summary = None
    if db and task.equipment_id:
        last = db.query(InspectionTask).filter(
            InspectionTask.equipment_id == task.equipment_id,
            InspectionTask.status == TaskStatus.COMPLETED,
            InspectionTask.id != task.id,
        ).order_by(InspectionTask.completed_at.desc()).first()
        if last:
            task.last_inspection_date = last.inspection_date
            task.last_inspector_name = last.inspector.real_name if last.inspector else None
            names = [d.defect_name for d in last.defects[:3]] if last.defects else []
            task.last_defect_summary = "、".join(names) if names else "无"

    if current_user:
        role = current_user.role
        is_inspector = role == UserRole.INSPECTOR
        is_manager_or_admin = role in [UserRole.MANAGER, UserRole.ADMIN]
        is_admin = role == UserRole.ADMIN
        is_assigned = task.inspector_id == current_user.id
        status = task.status.value if hasattr(task.status, 'value') else task.status

        task.can_accept = (is_inspector and is_assigned and status == 'pending') or \
                          (is_manager_or_admin and status == 'pending')
        task.can_edit = is_manager_or_admin and status in ['pending', 'suspended']
        task.can_cancel = is_manager_or_admin and status in ['pending', 'suspended', 'in_progress']
        task.can_suspend = is_manager_or_admin and status in ['pending', 'in_progress']
        task.can_resume = (is_manager_or_admin or is_assigned) and status == 'suspended'
        task.can_delete = is_admin and status in ['pending', 'cancelled']
        task.can_review = is_manager_or_admin and status == 'submitted'
        task.can_resubmit = (is_manager_or_admin or is_assigned) and status == 'rejected'


# ============================================================
# 查询
# ============================================================

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
    if current_user and current_user.role == UserRole.INSPECTOR:
        query = query.filter(InspectionTask.inspector_id == current_user.id)
    if keyword:
        query = query.filter(
            (InspectionTask.task_no.contains(keyword)) |
            (InspectionTask.equipment.has(equipment_name=keyword)) |
            (InspectionTask.inspector.has(real_name=keyword))
        )

    total = query.count()
    items = query.order_by(
        InspectionTask.priority.asc(),
        InspectionTask.created_at.desc()
    ).offset(skip).limit(limit).all()

    for item in items:
        _attach_extra_fields(item, current_user, db)

    return total, items


def get_task_statistics(db: Session, current_user=None):
    query = db.query(InspectionTask)
    if current_user and current_user.role == UserRole.INSPECTOR:
        query = query.filter(InspectionTask.inspector_id == current_user.id)

    total = query.count()
    pending = query.filter(InspectionTask.status == TaskStatus.PENDING).count()
    in_progress = query.filter(InspectionTask.status == TaskStatus.IN_PROGRESS).count()
    submitted = query.filter(InspectionTask.status == TaskStatus.SUBMITTED).count()
    completed = query.filter(InspectionTask.status == TaskStatus.COMPLETED).count()
    suspended = query.filter(InspectionTask.status == TaskStatus.SUSPENDED).count()

    return {
        "total": total,
        "pending_count": pending,
        "in_progress_count": in_progress,
        "submitted_count": submitted,
        "completed_count": completed,
        "suspended_count": suspended,
    }


def get_inspection_task(db: Session, task_id: int, current_user=None):
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if task:
        _attach_extra_fields(task, current_user, db)
    return task


def get_task_defects(db: Session, task_id: int):
    return db.query(TaskDefect).filter(TaskDefect.task_id == task_id).all()


# ============================================================
# 创建 & 编辑 & 删除
# ============================================================

def create_inspection_task(db: Session, data: InspectionTaskCreate, user_id: int):
    equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
    task = InspectionTask(
        task_no=generate_task_no(db),
        inspection_type=data.inspection_type,
        equipment_id=data.equipment_id,
        inspector_id=data.inspector_id,
        inspection_date=data.inspection_date,
        priority=data.priority,
        created_by=user_id,
        version=1,
    )
    if equipment:
        task.line_name = getattr(equipment, 'line_name', None)
        task.station_name = getattr(equipment, 'station_name', None)
        task.location_province = equipment.province
        task.location_city = equipment.city
        task.location_district = equipment.district
        task.location_street = equipment.street
        task.address_detail = equipment.address_detail
        task.longitude = equipment.longitude
        task.latitude = equipment.latitude
        task.customer_name = equipment.customer_name

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def edit_task(db: Session, task_id: int, data, expected_version: Optional[int] = None):
    """编辑任务基础信息（仅待巡检/挂起状态可编辑）"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task or task.status not in [TaskStatus.PENDING, TaskStatus.SUSPENDED]:
        return None
    _check_version(task, expected_version)
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(task, k, v)
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int, expected_version: Optional[int] = None):
    """删除任务（仅待巡检/已取消状态可删除）"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return False
    if task.status not in [TaskStatus.PENDING, TaskStatus.CANCELLED]:
        return False
    _check_version(task, expected_version)
    db.delete(task)
    db.commit()
    return True


# ============================================================
# 状态流转操作 (含锁 + 版本)
# ============================================================

def start_task(db: Session, task_id: int, expected_version: Optional[int] = None):
    """待巡检 → 进行中"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.IN_PROGRESS)
    task.status = TaskStatus.IN_PROGRESS
    task.started_at = datetime.utcnow()
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def submit_inspection(db: Session, task_id: int, data, expected_version: Optional[int] = None):
    """进行中 → 待审核"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.SUBMITTED)

    for photo_path in data.photos:
        db.add(TaskPhoto(task_id=task_id, file_path=photo_path))

    for defect in data.defects:
        db.add(TaskDefect(
            task_id=task_id,
            defect_type=defect.defect_type,
            defect_name=defect.defect_name,
            severity=defect.severity,
            confidence=defect.confidence,
            source=DefectSource[defect.source.upper()] if defect.source else DefectSource.MANUAL,
            description=defect.description,
            is_emergency=defect.is_emergency,
        ))

    task.status = TaskStatus.SUBMITTED
    task.audit_status = AuditStatus.PENDING
    task.submitted_at = datetime.utcnow()
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def review_task(db: Session, task_id: int, data, user_id: int, expected_version: Optional[int] = None):
    """待审核 → 已巡检(approve/correct) / 已驳回(reject)"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)

    task.reviewer_id = user_id

    if data.action == "approve":
        _validate_transition(task, TaskStatus.COMPLETED)
        task.status = TaskStatus.COMPLETED
        task.audit_status = AuditStatus.REVIEWED
        task.completed_at = datetime.utcnow()
        _bump_version(task)
        db.commit()
        _generate_defect_orders(db, task)
    elif data.action == "reject":
        _validate_transition(task, TaskStatus.REJECTED)
        task.status = TaskStatus.REJECTED
        task.audit_status = AuditStatus.REJECTED
        task.reject_reason = data.reason
        _bump_version(task)
        db.commit()
    elif data.action == "correct":
        _validate_transition(task, TaskStatus.COMPLETED)
        if data.corrected_defects:
            for d in data.corrected_defects:
                db.add(TaskDefect(
                    task_id=task_id,
                    defect_type=d.defect_type,
                    defect_name=d.defect_name,
                    severity=d.severity,
                    source=DefectSource.CORRECTED,
                    description=d.description,
                    is_emergency=d.is_emergency,
                ))
        task.status = TaskStatus.COMPLETED
        task.audit_status = AuditStatus.REVIEWED
        task.completed_at = datetime.utcnow()
        _bump_version(task)
        db.commit()
        _generate_defect_orders(db, task)

    db.refresh(task)
    return task


def suspend_task(db: Session, task_id: int, reason: str, expected_version: Optional[int] = None):
    """待巡检/进行中 → 已挂起（需填写原因）"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.SUSPENDED)
    if not reason or not reason.strip():
        raise ValueError("挂起原因不能为空")
    task.status = TaskStatus.SUSPENDED
    task.suspend_reason = reason.strip()
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def resume_task(db: Session, task_id: int, reason: str = None, material: str = None,
                expected_time: str = None, expected_version: Optional[int] = None):
    """已挂起 → 待巡检"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.PENDING)
    task.status = TaskStatus.PENDING
    task.resume_reason = reason
    task.resume_material = material
    task.resume_expected_time = expected_time
    task.suspend_reason = None
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def cancel_task(db: Session, task_id: int, reason: str, expected_version: Optional[int] = None):
    """待巡检/进行中/已挂起 → 已取消（需填写原因）"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.CANCELLED)
    if not reason or not reason.strip():
        raise ValueError("取消原因不能为空")
    task.status = TaskStatus.CANCELLED
    task.cancel_reason = reason.strip()
    task.cancelled_at = datetime.utcnow()
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


def resubmit_task(db: Session, task_id: int, expected_version: Optional[int] = None):
    """已驳回 → 待巡检（重新派发）"""
    task = db.query(InspectionTask).filter(InspectionTask.id == task_id).first()
    if not task:
        return None
    _check_version(task, expected_version)
    _validate_transition(task, TaskStatus.PENDING)
    task.status = TaskStatus.PENDING
    task.audit_status = None
    task.reject_reason = None
    task.submitted_at = None
    _bump_version(task)
    db.commit()
    db.refresh(task)
    return task


# ============================================================
# 内部辅助
# ============================================================

def _generate_defect_orders(db: Session, task: InspectionTask):
    """巡检通过后，1:N拆解缺陷为消缺工单"""
    from datetime import timedelta

    for defect in task.defects:
        now = datetime.utcnow()
        is_emerg = defect.is_emergency == "true"
        if is_emerg:
            deadline = now + timedelta(hours=4)
        else:
            sla_hours = {1: 24, 2: 72, 3: 168}
            deadline = now + timedelta(hours=sla_hours.get(defect.severity, 168))

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
            location_street=task.location_street,
            location_detail=task.address_detail,
            longitude=task.longitude,
            latitude=task.latitude,
            customer_name=task.customer_name,
            equipment_name=task.equipment.equipment_name if task.equipment else None,
            equipment_type=task.equipment.equipment_type if task.equipment else None,
            inspector_name=task.inspector.real_name if task.inspector else None,
            reviewer_name=task.reviewer.real_name if task.reviewer else None,
            description=defect.description,
            before_photo_path=defect.photo.file_path if defect.photo else None,
            deadline=deadline,
            version=1,
        )
        db.add(order)
