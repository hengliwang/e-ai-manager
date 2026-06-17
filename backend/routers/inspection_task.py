from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.inspection_task import (
    InspectionTaskCreate, InspectionTaskResponse, InspectionTaskListResponse,
    SubmitInspectionRequest, ReviewRequest
)
from services.inspection_service import (
    get_inspection_tasks, get_inspection_task, create_inspection_task,
    start_task, submit_inspection, review_task, suspend_task, resume_task,
    cancel_task, get_task_defects
)
from middleware.auth_middleware import get_current_user
from models.user import User

router = APIRouter(prefix="/api/inspection-tasks", tags=["inspection"])


@router.get("", response_model=InspectionTaskListResponse)
def list_tasks(
    skip: int = Query(0), limit: int = Query(20),
    status: Optional[str] = None,
    inspector_id: Optional[int] = None,
    inspection_type: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, items = get_inspection_tasks(db, skip, limit, status, inspector_id, inspection_type, keyword, current_user)
    return InspectionTaskListResponse(total=total, items=items)


@router.get("/{task_id}", response_model=InspectionTaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_inspection_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("", response_model=InspectionTaskResponse)
def create_task(
    data: InspectionTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_inspection_task(db, data, current_user.id)


@router.post("/{task_id}/start")
def start_task_handler(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = start_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "任务已开始", "status": task.status.value}


@router.post("/{task_id}/submit")
def submit_task(
    task_id: int,
    data: SubmitInspectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = submit_inspection(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "提交成功"}


@router.post("/{task_id}/review")
def review_task_handler(
    task_id: int,
    data: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="仅负责人可审核")
    task = review_task(db, task_id, data, current_user.id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "审核完成", "status": task.status.value}


@router.post("/{task_id}/suspend")
def suspend_task_handler(
    task_id: int,
    reason: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = suspend_task(db, task_id, reason)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "任务已挂起"}


@router.post("/{task_id}/resume")
def resume_task_handler(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = resume_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "任务已恢复"}


@router.post("/{task_id}/cancel")
def cancel_task_handler(
    task_id: int,
    reason: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = cancel_task(db, task_id, reason)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "任务已取消"}


@router.get("/{task_id}/defects")
def get_defects(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    defects = get_task_defects(db, task_id)
    return [
        {
            "id": d.id,
            "defect_type": d.defect_type,
            "defect_name": d.defect_name,
            "severity": d.severity,
            "confidence": d.confidence,
            "source": d.source.value if d.source else "manual",
            "description": d.description,
            "is_emergency": d.is_emergency,
            "ai_raw_result": d.ai_raw_result,
        }
        for d in defects
    ]
