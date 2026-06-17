from pydantic import BaseModel
from typing import Optional


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
    phone: Optional[str] = None
    department: Optional[str] = None
    region: Optional[str] = None
    is_active: bool = True

    class Config:
        from_attributes = True
