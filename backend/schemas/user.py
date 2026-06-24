from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
import re


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    real_name: str
    role: str


class UserInfo(BaseModel):
    id: int
    username: str
    real_name: str
    role: str
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    account_type: str = "employee"
    department: Optional[str] = None
    region: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def coerce_types(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in list(data.keys()):
                v = data[k]
                if isinstance(v, datetime):
                    data[k] = v.isoformat()
                elif hasattr(v, 'value'):
                    data[k] = v.value
        else:
            for k in ('created_at',):
                if hasattr(data, k):
                    v = getattr(data, k)
                    if isinstance(v, datetime):
                        object.__setattr__(data, k, v.isoformat())
            if hasattr(data, 'role') and hasattr(data.role, 'value'):
                object.__setattr__(data, 'role', data.role.value)
            if hasattr(data, 'account_type') and hasattr(data.account_type, 'value'):
                object.__setattr__(data, 'account_type', data.account_type.value)
        return data


class CreateUserRequest(BaseModel):
    username: str
    password: str
    real_name: str
    role: str = "inspector"
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    account_type: str = "employee"
    department: Optional[str] = None
    region: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("请输入正确的11位手机号")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"admin", "manager", "inspector", "repairer"}
        if v not in allowed:
            raise ValueError(f"无效角色: {v}")
        return v

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: str) -> str:
        allowed = {"employee", "customer", "regulator"}
        if v not in allowed:
            raise ValueError(f"无效账号类型: {v}")
        return v


class UpdateUserRequest(BaseModel):
    real_name: Optional[str] = None
    role: Optional[str] = None
    employee_id: Optional[str] = None
    phone: Optional[str] = None
    account_type: Optional[str] = None
    department: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("请输入正确的11位手机号")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"admin", "manager", "inspector", "repairer"}
        if v not in allowed:
            raise ValueError(f"无效角色: {v}")
        return v

    @field_validator("account_type")
    @classmethod
    def validate_account_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"employee", "customer", "regulator"}
        if v not in allowed:
            raise ValueError(f"无效账号类型: {v}")
        return v


class ResetPasswordRequest(BaseModel):
    password: str


class UserListResponse(BaseModel):
    total: int
    items: List[UserInfo]
