from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import case
from models.defect_order import DefectOrder, DefectOrderStatus, STATE_TRANSITIONS, STATUS_NAMES
from models.user import User, UserRole
from models.equipment import Equipment


# ============================================================
# 5 状态机定义
#
#   待处理(PENDING) ──assign──▶ 处理中(IN_PROGRESS)
#       │                            │
#       │                 ┌──────────┼──────────┐
#       │            fully_resolved  │   partially_resolved
#       │                 │          │          │
#       │                 ▼          ▼          │
#       │          已全部消除   已部分消除──────┘
#       │          (FULLY_       (PARTIALLY_
#       │           RESOLVED)     RESOLVED)
#       │                            │
#       │                      fully_resolved
#       │                            │
#       │                            ▼
#       │                      已全部消除(FULLY_RESOLVED)
#       │
#       ├──cancel──▶ 已取消(CANCELLED)
#
#   PENDING            → IN_PROGRESS, CANCELLED
#   IN_PROGRESS        → FULLY_RESOLVED, PARTIALLY_RESOLVED, CANCELLED
#   PARTIALLY_RESOLVED → FULLY_RESOLVED, PARTIALLY_RESOLVED, CANCELLED
#   FULLY_RESOLVED     → (终态)
#   CANCELLED          → (终态)
# ============================================================


class StateTransitionError(Exception):
    """状态流转异常"""
    def __init__(self, current, target, detail: str = ""):
        cur_name = STATUS_NAMES.get(current, current.value if hasattr(current, 'value') else current)
        tar_name = STATUS_NAMES.get(target, target.value if hasattr(target, 'value') else target)
        msg = f"不允许从「{cur_name}」转为「{tar_name}」"
        if detail:
            msg += f"：{detail}"
        super().__init__(msg)
        self.current = current
        self.target = target
        self.detail = detail


class ConcurrencyError(Exception):
    """并发冲突异常"""
    def __init__(self, order_id: int):
        super().__init__(f"工单 #{order_id} 已被其他操作修改，请刷新后重试")


def _validate_transition(order: DefectOrder, target: DefectOrderStatus) -> None:
    current = order.status
    if isinstance(current, str):
        current = DefectOrderStatus(current)
    if isinstance(target, str):
        target = DefectOrderStatus(target)
    allowed = STATE_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise StateTransitionError(current, target)


def _check_version(order: DefectOrder, expected_version: Optional[int]) -> None:
    if expected_version is not None and order.version != expected_version:
        raise ConcurrencyError(order.id)


def _bump_version(order: DefectOrder) -> None:
    order.version = (order.version or 0) + 1


def _compute_overdue_days(order: DefectOrder) -> Optional[int]:
    """计算超期天数"""
    now = datetime.utcnow()
    if order.status in [DefectOrderStatus.FULLY_RESOLVED, DefectOrderStatus.CANCELLED]:
        return None
    if order.deadline and now > order.deadline:
        return (now - order.deadline).days
    return None


def _compute_sla_deadline(severity: int, is_emergency: str = "false") -> datetime:
    """根据等级计算SLA截止时间"""
    now = datetime.utcnow()
    if is_emergency == "true":
        return now + timedelta(hours=4)
    sla_hours = {1: 24, 2: 72, 3: 168}  # 危急24h, 严重72h, 一般7天
    return now + timedelta(hours=sla_hours.get(severity, 168))


def generate_order_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    count = db.query(DefectOrder).count() + 1
    return f"DEF{today}{count:04d}"


# ============================================================
# 工具函数
# ============================================================

def _attach_extra_fields(order: DefectOrder, current_user=None, db: Session = None):
    """附加权限标记 + 超期天数 + 历史字段"""
    # 超期天数
    order.overdue_days = _compute_overdue_days(order)

    if current_user:
        role = current_user.role
        is_repairer = role == UserRole.REPAIRER
        is_manager_or_admin = role in [UserRole.MANAGER, UserRole.ADMIN]
        status = order.status.value if hasattr(order.status, 'value') else order.status

        order.can_assign = is_manager_or_admin and status in ['pending']
        order.can_start = (is_repairer or is_manager_or_admin) and status == 'pending'
        order.can_process = (is_repairer or is_manager_or_admin) and status in ['in_progress', 'partially_resolved']
        order.can_cancel = is_manager_or_admin and status in ['pending', 'in_progress', 'partially_resolved']
        order.can_delete = (role == UserRole.ADMIN) and status in ['cancelled']


# ============================================================
# 查询
# ============================================================

def get_defect_orders(
    db: Session, skip: int = 0, limit: int = 20,
    status: str = None, severity: int = None,
    is_emergency: str = None, keyword: str = None,
    repairer_id: int = None, inspector_name: str = None,
    defect_type: str = None, equipment_type: str = None,
    location: str = None, customer_name: str = None,
    current_user=None,
):
    query = db.query(DefectOrder)

    # 角色数据隔离
    if current_user:
        if current_user.role == UserRole.REPAIRER:
            query = query.filter(DefectOrder.repairer_id == current_user.id)
        elif current_user.role == UserRole.INSPECTOR:
            query = query.filter(DefectOrder.inspector_name == current_user.real_name)

    if status:
        query = query.filter(DefectOrder.status == status)
    if severity:
        query = query.filter(DefectOrder.severity == severity)
    if is_emergency:
        query = query.filter(DefectOrder.is_emergency == is_emergency)
    if repairer_id:
        query = query.filter(DefectOrder.repairer_id == repairer_id)
    if inspector_name:
        query = query.filter(DefectOrder.inspector_name.contains(inspector_name))
    if defect_type:
        query = query.filter(DefectOrder.defect_type == defect_type)
    if equipment_type:
        query = query.filter(DefectOrder.equipment_type == equipment_type)
    if customer_name:
        query = query.filter(DefectOrder.customer_name.contains(customer_name))
    if location:
        query = query.filter(
            (DefectOrder.location_province.contains(location)) |
            (DefectOrder.location_city.contains(location)) |
            (DefectOrder.location_district.contains(location))
        )
    if keyword:
        query = query.filter(
            (DefectOrder.order_no.contains(keyword)) |
            (DefectOrder.defect_name.contains(keyword)) |
            (DefectOrder.equipment_name.contains(keyword)) |
            (DefectOrder.inspector_name.contains(keyword)) |
            (DefectOrder.repairer_name.contains(keyword))
        )

    total = query.count()
    items = query.order_by(
        case((DefectOrder.is_emergency == "true", 0), else_=1),  # 紧急抢修置顶
        DefectOrder.severity.asc(),                                 # 等级从高到低
        DefectOrder.deadline.asc(),                                 # 即将超期优先
        DefectOrder.created_at.desc(),
    ).offset(skip).limit(limit).all()

    for item in items:
        _attach_extra_fields(item, current_user, db)

    return total, items


def get_defect_order(db: Session, order_id: int, current_user=None):
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if order:
        _attach_extra_fields(order, current_user, db)
    return order


def get_order_statistics(db: Session, current_user=None) -> dict:
    """角色化统计看板：一线/班组/公司三级聚合"""
    base = db.query(DefectOrder)

    if current_user:
        if current_user.role == UserRole.REPAIRER:
            base = base.filter(DefectOrder.repairer_id == current_user.id)
        elif current_user.role == UserRole.INSPECTOR:
            base = base.filter(DefectOrder.inspector_name == current_user.real_name)

    def _count(status_filter=None, overdue=False):
        q = base
        if status_filter:
            q = q.filter(DefectOrder.status == status_filter)
        if overdue:
            q = q.filter(
                DefectOrder.deadline < datetime.utcnow(),
                ~DefectOrder.status.in_([DefectOrderStatus.FULLY_RESOLVED, DefectOrderStatus.CANCELLED])
            )
        return q.count()

    return {
        "total": _count(),
        "pending_count": _count(DefectOrderStatus.PENDING),
        "in_progress_count": _count(DefectOrderStatus.IN_PROGRESS),
        "fully_resolved_count": _count(DefectOrderStatus.FULLY_RESOLVED),
        "partially_resolved_count": _count(DefectOrderStatus.PARTIALLY_RESOLVED),
        "overdue_count": _count(overdue=True),
    }


# ============================================================
# 创建（自动生成 + 手动创建）
# ============================================================

def create_defect_order(db: Session, data, user_id: int) -> DefectOrder:
    """手动创建消缺工单"""
    order = DefectOrder(
        order_no=generate_order_no(db),
        equipment_id=data.equipment_id,
        defect_type=data.defect_type,
        defect_name=data.defect_name,
        severity=data.severity,
        is_emergency=data.is_emergency or "false",
        description=data.description,
        deadline=_compute_sla_deadline(data.severity, data.is_emergency),
        version=1,
    )

    # 关联设备信息
    if data.equipment_id:
        equipment = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
        if equipment:
            order.equipment_name = equipment.equipment_name
            order.equipment_type = equipment.equipment_type
            order.customer_name = equipment.customer_name
            order.location_province = equipment.province
            order.location_city = equipment.city
            order.location_district = equipment.district
            order.location_street = equipment.street
            order.location_detail = equipment.address_detail
            order.longitude = equipment.longitude
            order.latitude = equipment.latitude

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


# ============================================================
# 状态流转操作（含锁 + 版本）
# ============================================================

def assign_order(db: Session, order_id: int, repairer_id: int,
                 expected_version: Optional[int] = None) -> DefectOrder:
    """待处理 → 处理中（派发处理人）"""
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    _check_version(order, expected_version)
    _validate_transition(order, DefectOrderStatus.IN_PROGRESS)

    repairer = db.query(User).filter(User.id == repairer_id).first()
    order.repairer_id = repairer_id
    order.repairer_name = repairer.real_name if repairer else None
    order.status = DefectOrderStatus.IN_PROGRESS
    order.assigned_at = datetime.utcnow()
    order.started_at = datetime.utcnow()
    if not order.deadline:
        order.deadline = _compute_sla_deadline(order.severity, order.is_emergency)
    _bump_version(order)
    db.commit()
    db.refresh(order)
    return order


def process_order(db: Session, order_id: int, data,
                  expected_version: Optional[int] = None) -> DefectOrder:
    """处理中/已部分消除 → 已全部消除/已部分消除"""
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    _check_version(order, expected_version)

    target = DefectOrderStatus(data.process_status)
    _validate_transition(order, target)

    order.status = target
    order.process_description = data.process_description
    if data.after_photo_paths:
        order.after_photo_paths = data.after_photo_paths
    if target == DefectOrderStatus.FULLY_RESOLVED:
        order.completed_at = datetime.utcnow()

    # 记录历史处理字段
    order.last_processed_date = datetime.utcnow()
    order.last_process_result = target.value
    # last_processor_name set from current_user in router

    _bump_version(order)
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int, reason: str,
                 expected_version: Optional[int] = None) -> DefectOrder:
    """取消工单（需填写原因）"""
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    _check_version(order, expected_version)
    _validate_transition(order, DefectOrderStatus.CANCELLED)
    if not reason or not reason.strip():
        raise ValueError("取消原因不能为空")

    order.status = DefectOrderStatus.CANCELLED
    order.cancel_reason = reason.strip()
    order.cancelled_at = datetime.utcnow()
    _bump_version(order)
    db.commit()
    db.refresh(order)
    return order


def update_order(db: Session, order_id: int, data,
                 expected_version: Optional[int] = None) -> DefectOrder:
    """更新工单基础信息（仅待处理状态可编辑）"""
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return None
    if order.status != DefectOrderStatus.PENDING:
        return None
    _check_version(order, expected_version)

    if data.repairer_id is not None:
        repairer = db.query(User).filter(User.id == data.repairer_id).first()
        order.repairer_id = data.repairer_id
        order.repairer_name = repairer.real_name if repairer else None
    if data.description is not None:
        order.description = data.description
    if data.severity is not None:
        order.severity = data.severity
        order.deadline = _compute_sla_deadline(data.severity, order.is_emergency)

    _bump_version(order)
    db.commit()
    db.refresh(order)
    return order


def delete_order(db: Session, order_id: int,
                 expected_version: Optional[int] = None) -> bool:
    """删除工单（仅已取消状态可删除）"""
    order = db.query(DefectOrder).filter(DefectOrder.id == order_id).first()
    if not order:
        return False
    if order.status != DefectOrderStatus.CANCELLED:
        return False
    _check_version(order, expected_version)
    db.delete(order)
    db.commit()
    return True


# ============================================================
# 看板复用
# ============================================================

def get_dashboard_stats(db: Session):
    from models.equipment import Equipment
    from models.inspection_task import InspectionTask, TaskStatus

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
    from sqlalchemy import func
    results = db.query(DefectOrder.defect_name, func.count(DefectOrder.id)).group_by(DefectOrder.defect_name).all()
    return [{"name": r[0] or "未分类", "value": r[1]} for r in results]
