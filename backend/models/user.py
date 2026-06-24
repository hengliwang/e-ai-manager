from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    INSPECTOR = "inspector"
    REPAIRER = "repairer"


class AccountType(str, enum.Enum):
    EMPLOYEE = "employee"
    CUSTOMER = "customer"
    REGULATOR = "regulator"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    real_name = Column(String(50), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.INSPECTOR)
    employee_id = Column(String(50), unique=True)
    phone = Column(String(20))
    account_type = Column(SQLEnum(AccountType), nullable=False, default=AccountType.EMPLOYEE)
    department = Column(String(100))
    region = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    inspection_tasks = relationship("InspectionTask", foreign_keys="InspectionTask.inspector_id", back_populates="inspector")
    reviewed_tasks = relationship("InspectionTask", foreign_keys="InspectionTask.reviewer_id", back_populates="reviewer")
