from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.user import (
    CreateUserRequest, UpdateUserRequest, ResetPasswordRequest,
    UserInfo, UserListResponse
)
from services.user_service import (
    get_users, get_user_by_id, create_user, update_user,
    delete_user, reset_password, toggle_status
)
from middleware.auth_middleware import get_current_user, require_role
from models.user import User, UserRole

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=UserListResponse)
def list_users(
    skip: int = Query(0),
    limit: int = Query(20),
    keyword: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    total, items = get_users(db, skip, limit, keyword, role, is_active)
    return UserListResponse(total=total, items=items)


@router.get("/{user_id}", response_model=UserInfo)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("", response_model=UserInfo)
def create_user_handler(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        return create_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{user_id}", response_model=UserInfo)
def update_user_handler(
    user_id: int,
    data: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    try:
        user = update_user(db, user_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.delete("/{user_id}")
def delete_user_handler(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己的账号")
    if not delete_user(db, user_id):
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"message": "删除成功"}


@router.put("/{user_id}/password")
def reset_password_handler(
    user_id: int,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if not data.password or len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少6位")
    user = reset_password(db, user_id, data.password)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"message": "密码重置成功"}


@router.put("/{user_id}/toggle-status")
def toggle_status_handler(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能禁用自己的账号")
    user = toggle_status(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {"message": "状态已变更", "is_active": user.is_active}
