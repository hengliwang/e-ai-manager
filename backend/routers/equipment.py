from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.equipment import (
    EquipmentCreate, EquipmentUpdate, EquipmentResponse, EquipmentListResponse,
    FieldConfigCreate, FieldConfigUpdate, FieldConfigResponse, OptionManageRequest
)
from services.equipment_service import (
    get_equipment_list, get_equipment, create_equipment, update_equipment,
    delete_equipment, get_field_configs, create_field_config, update_field_config,
    delete_field_config, manage_field_options, export_equipment_excel, import_equipment_excel
)
from middleware.auth_middleware import get_current_user
from models.user import User
from fastapi.responses import StreamingResponse
import os
import shutil
from config import PHOTO_DIR

router = APIRouter(prefix="/api/equipment", tags=["equipment"])

# ===== 列表/创建 (无参数路由) =====

@router.get("", response_model=EquipmentListResponse)
def list_equipment(
    skip: int = Query(0), limit: int = Query(20),
    category: Optional[str] = None,
    equipment_type: Optional[str] = None,
    keyword: Optional[str] = None,
    customer_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total, items = get_equipment_list(db, skip, limit, category, equipment_type, keyword, customer_name)
    return EquipmentListResponse(total=total, items=items)


@router.post("", response_model=EquipmentResponse)
def create_equipment_handler(
    data: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_equipment(db, data, current_user.id)


# ===== 静态路径路由 (必须在参数路由之前) =====

@router.post("/upload-photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1].lower()
    allowed_exts = {"jpg", "jpeg", "png", "gif", "mp4", "mov", "avi", "webm"}
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")
    filename = f"{current_user.id}_{os.urandom(4).hex()}.{ext}"
    file_path = os.path.join(PHOTO_DIR, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"file_path": f"/photos/{filename}", "filename": filename}


# ----- 字段配置管理 -----

@router.get("/field-configs", response_model=list[FieldConfigResponse])
def list_field_configs(
    include_disabled: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_field_configs(db, include_disabled)


@router.post("/field-configs", response_model=FieldConfigResponse)
def create_field_config_handler(
    data: FieldConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可管理字段配置")
    try:
        return create_field_config(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/field-configs/{config_id}", response_model=FieldConfigResponse)
def update_field_config_handler(
    config_id: int,
    data: FieldConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可管理字段配置")
    try:
        config = update_field_config(db, config_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not config:
        raise HTTPException(status_code=404, detail="字段配置不存在")
    return config


@router.delete("/field-configs/{config_id}")
def delete_field_config_handler(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可管理字段配置")
    result = delete_field_config(db, config_id)
    if not result:
        raise HTTPException(status_code=404, detail="字段配置不存在")
    return {"message": "删除成功"}


@router.post("/field-configs/{config_id}/options", response_model=FieldConfigResponse)
def manage_options_handler(
    config_id: int,
    data: OptionManageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可管理选项")
    option = data.option.model_dump() if data.option else None
    config = manage_field_options(db, config_id, data.action, option, data.old_value)
    if not config:
        raise HTTPException(status_code=404, detail="字段配置不存在或无选项")
    return config


# ----- 导入导出 -----

@router.get("/export")
def export_equipment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    output = export_equipment_excel(db)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=equipment_export.xlsx"}
    )


@router.post("/import")
async def import_equipment(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ("xlsx", "xls"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 或 .xls 格式的文件")
    contents = await file.read()
    result = import_equipment_excel(db, contents, current_user.id)
    return result


# ===== 参数路由 (/{equipment_id} 必须在静态路由之后) =====

@router.get("/{equipment_id}", response_model=EquipmentResponse)
def get_equipment_detail(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = get_equipment(db, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="设备不存在")
    return equipment


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment_handler(
    equipment_id: int,
    data: EquipmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    equipment = update_equipment(db, equipment_id, data, current_user.id)
    if not equipment:
        raise HTTPException(status_code=404, detail="设备不存在")
    return equipment


@router.delete("/{equipment_id}")
def delete_equipment_handler(
    equipment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value not in ["admin"]:
        raise HTTPException(status_code=403, detail="仅管理员可删除")
    result = delete_equipment(db, equipment_id)
    if not result:
        raise HTTPException(status_code=404, detail="设备不存在")
    return {"message": "删除成功"}
