from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.inspection_task import (
    InspectionTaskCreate, InspectionTaskUpdate, InspectionTaskResponse,
    InspectionTaskListResponse, TaskStatisticsResponse,
    SubmitInspectionRequest, ReviewRequest, CancelRequest, SuspendRequest, ResumeRequest
)
from services.inspection_service import (
    get_inspection_tasks, get_task_statistics, get_inspection_task,
    create_inspection_task, edit_task, delete_task,
    start_task, submit_inspection, review_task, suspend_task, resume_task,
    cancel_task, resubmit_task, get_task_defects,
    StateTransitionError, ConcurrencyError
)
from middleware.auth_middleware import get_current_user, require_role
from models.user import User, UserRole

router = APIRouter(prefix="/api/inspection-tasks", tags=["inspection"])

# ========== 静态路由 (必须写在参数路由前) ==========

@router.get("/statistics", response_model=TaskStatisticsResponse)
def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_task_statistics(db, current_user)


# ========== 列表/创建 ==========

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


@router.post("", response_model=InspectionTaskResponse)
def create_task(
    data: InspectionTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    return create_inspection_task(db, data, current_user.id)


# ========== 参数路由 ==========

@router.get("/{task_id}", response_model=InspectionTaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_inspection_task(db, task_id, current_user)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.put("/{task_id}", response_model=InspectionTaskResponse)
def edit_task_handler(
    task_id: int,
    data: InspectionTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    task = edit_task(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在或状态不允许编辑")
    return task


@router.delete("/{task_id}")
def delete_task_handler(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    if not delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="任务不存在或状态不允许删除(仅待巡检/已取消可删除)")
    return {"message": "任务已删除"}


# ========== 状态流转 ==========

@router.post("/{task_id}/start")
def start_task_handler(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = start_task(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "任务已开始", "status": task.status.value}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/submit")
def submit_task(
    task_id: int,
    data: SubmitInspectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = submit_inspection(db, task_id, data)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "提交成功"}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/review")
def review_task_handler(
    task_id: int,
    data: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    try:
        task = review_task(db, task_id, data, current_user.id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "审核完成", "status": task.status.value}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/suspend")
def suspend_task_handler(
    task_id: int,
    data: SuspendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    try:
        task = suspend_task(db, task_id, data.reason)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "任务已挂起"}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/resume")
def resume_task_handler(
    task_id: int,
    data: ResumeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = resume_task(db, task_id, data.reason, data.material, data.expected_time)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "任务已恢复"}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/cancel")
def cancel_task_handler(
    task_id: int,
    data: CancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.ADMIN)),
):
    try:
        task = cancel_task(db, task_id, data.reason)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "任务已取消"}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{task_id}/resubmit")
def resubmit_task_handler(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """已驳回 → 待巡检（重新派发）"""
    try:
        task = resubmit_task(db, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        return {"message": "任务已重新派发", "status": task.status.value}
    except StateTransitionError as e:
        raise HTTPException(status_code=409, detail=str(e))


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
