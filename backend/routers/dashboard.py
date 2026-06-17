from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.defect_service import get_dashboard_stats, get_defect_distribution
from middleware.auth_middleware import get_current_user
from models.user import User

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_dashboard_stats(db)


@router.get("/defect-distribution")
def defect_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_defect_distribution(db)
