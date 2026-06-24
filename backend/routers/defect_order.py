from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.defect_order import (
    DefectOrderCreate, DefectOrderUpdate, DefectOrderResponse,
    DefectOrderListResponse, OrderStatisticsResponse,
    AssignRequest, ProcessRequest, CancelRequest,
)
from services.defect_service import (
    get_defect_orders, get_defect_order, get_order_statistics,
    create_defect_order, update_order, delete_order,
    assign_order, process_order, cancel_order,
    StateTransitionError, ConcurrencyError, generate_order_no,
)
from middleware.auth_middleware import get_current_user, require_role
from models.user import User, UserRole

router = APIRouter(prefix="/api/defect-orders", tags=["defect"])


# ========== 静态路由 ==========

@router.get("/statistics", response_model=OrderStatisticsResponse)
def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_order_statistics(db, current_user)


# ========== 列表 / 创建 ==========

@router.get("", response_model=DefectOrderListResponse)
def list_orders(
    skip: int = Query(0), limit: int = Query(20),
    status: Optional[str] = None,
    severity: Optional[int] = None,
    is_emergency: Optional[str] = None,
    keyword: Optional[str] = None,
    repairer_id: Optional[int] = None,
    inspector_name: Optional[str] = None,
    defect_type: Optional[str] = None,
    equipment_type: Optional[str] = None,
    location: Optional[str] = None,
    customer_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, items = get_defect_orders(
        db, skip, limit, status, severity, is_emergency,
        keyword, repairer_id, inspector_name, defect_type,
        equipment_type, location, customer_name,
        current_user,
    )
    return DefectOrderListResponse(total=total, items=items)


@router.post("", response_model=DefectOrderResponse)
def create_order(
    data: DefectOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    return create_defect_order(db, data, current_user.id)


# ========== 参数路由 ==========

@router.get("/{order_id}", response_model=DefectOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_defect_order(db, order_id, current_user)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.put("/{order_id}", response_model=DefectOrderResponse)
def update_order_handler(
    order_id: int,
    data: DefectOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    try:
        order = update_order(db, order_id, data)
        if not order:
            raise HTTPException(status_code=404, detail="工单不存在或状态不允许编辑")
        return order
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/{order_id}")
def delete_order_handler(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        if not delete_order(db, order_id):
            raise HTTPException(status_code=404, detail="工单不存在或状态不允许删除(仅已取消可删除)")
        return {"message": "工单已删除"}
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ========== 状态流转 ==========

@router.post("/{order_id}/assign")
def assign_order_handler(
    order_id: int,
    data: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """待处理 → 处理中（派发处理人）"""
    try:
        order = assign_order(db, order_id, data.repairer_id)
        if not order:
            raise HTTPException(status_code=404, detail="工单不存在")
        return {"message": "已派发", "status": order.status.value, "repairer_name": order.repairer_name}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{order_id}/process")
def process_order_handler(
    order_id: int,
    data: ProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """处理工单：已全部消除 / 已部分消除"""
    try:
        order = process_order(db, order_id, data)
        if not order:
            raise HTTPException(status_code=404, detail="工单不存在")
        # 记录处理人
        order.last_processor_name = current_user.real_name
        db.commit()
        return {"message": "处理完成", "status": order.status.value}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{order_id}/cancel")
def cancel_order_handler(
    order_id: int,
    data: CancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    """取消工单"""
    try:
        order = cancel_order(db, order_id, data.reason)
        if not order:
            raise HTTPException(status_code=404, detail="工单不存在")
        return {"message": "工单已取消"}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ConcurrencyError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
