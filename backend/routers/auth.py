from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from schemas.user import LoginRequest, LoginResponse, UserInfo
from services.auth_service import authenticate_user, create_access_token
from middleware.auth_middleware import get_current_user
from models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(user.id)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        real_name=user.real_name,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        real_name=current_user.real_name,
        role=current_user.role.value if hasattr(current_user.role, 'value') else current_user.role,
        employee_id=current_user.employee_id,
        phone=current_user.phone,
        account_type=current_user.account_type.value if hasattr(current_user.account_type, 'value') else current_user.account_type,
        department=current_user.department,
        region=current_user.region,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None,
    )
