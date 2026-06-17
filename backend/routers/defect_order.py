from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.defect_order import DefectOrderUpdate, DefectOrderResponse, DefectOrderListResponse
from services.defect_service import (
    get_defect_orders, get_defect_order, update_defect_order,
    complete_defect_order, cancel_defect_order
)
from middleware.auth_middleware import get_current_user
from models.user import User

router = APIRouter(prefix="/api/defect-orders", tags=["defect"])


@router.get("", response_model=DefectOrderListResponse)
def list_orders(
    skip: int = Query(0), limit: int = Query(20),
    status: Optional[str] = None,
    severity: Optional[int] = None,
    is_emergency: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, items = get_defect_orders(db, skip, limit, status, severity, is_emergency, keyword)
    return DefectOrderListResponse(total=total, items=items)


@router.get("/{order_id}", response_model=DefectOrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = get_defect_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.put("/{order_id}", response_model=DefectOrderResponse)
def update_order(
    order_id: int,
    data: DefectOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = update_defect_order(db, order_id, data)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return order


@router.post("/{order_id}/complete")
def complete_order(
    order_id: int,
    status: str = Query("fully_resolved"),
    after_photo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = complete_defect_order(db, order_id, status, after_photo)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return {"message": "消缺完成"}


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = cancel_defect_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return {"message": "工单已取消"}
