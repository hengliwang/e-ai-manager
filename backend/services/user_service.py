from sqlalchemy.orm import Session
from sqlalchemy import or_
from models.user import User
from services.auth_service import hash_password
from typing import Optional, Tuple, List


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    keyword: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Tuple[int, List[User]]:
    q = db.query(User)
    if keyword:
        q = q.filter(
            or_(
                User.username.contains(keyword),
                User.real_name.contains(keyword),
                User.phone.contains(keyword),
                User.employee_id.contains(keyword),
            )
        )
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    total = q.count()
    items = q.order_by(User.id).offset(skip).limit(limit).all()
    return total, items


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, data) -> User:
    if db.query(User).filter(User.username == data.username).first():
        raise ValueError(f"用户名 '{data.username}' 已存在")
    if data.employee_id and db.query(User).filter(User.employee_id == data.employee_id).first():
        raise ValueError(f"工号 '{data.employee_id}' 已存在")
    if data.phone and db.query(User).filter(User.phone == data.phone).first():
        raise ValueError(f"手机号 '{data.phone}' 已被注册")

    user = User(
        username=data.username,
        password=hash_password(data.password),
        real_name=data.real_name,
        role=data.role,
        employee_id=data.employee_id,
        phone=data.phone,
        account_type=data.account_type,
        department=data.department,
        region=data.region,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data) -> Optional[User]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    update_data = data.model_dump(exclude_unset=True)
    if "employee_id" in update_data and update_data["employee_id"] != user.employee_id:
        if db.query(User).filter(User.employee_id == update_data["employee_id"]).first():
            raise ValueError(f"工号 '{update_data['employee_id']}' 已存在")
    if "phone" in update_data and update_data["phone"] != user.phone:
        if db.query(User).filter(User.phone == update_data["phone"]).first():
            raise ValueError(f"手机号 '{update_data['phone']}' 已被注册")

    for k, v in update_data.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


def reset_password(db: Session, user_id: int, new_password: str) -> Optional[User]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    user.password = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


def toggle_status(db: Session, user_id: int) -> Optional[User]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
