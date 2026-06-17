from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.equipment import (
    EquipmentCreate, EquipmentUpdate, EquipmentResponse, EquipmentListResponse,
    FieldConfigCreate, FieldConfigResponse
)
from services.equipment_service import (
    get_equipment_list, get_equipment, create_equipment, update_equipment,
    delete_equipment, get_field_configs, create_field_config
)
from middleware.auth_middleware import get_current_user
from models.user import User
import os
import shutil
from config import PHOTO_DIR

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


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


@router.post("", response_model=EquipmentResponse)
def create_equipment_handler(
    data: EquipmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_equipment(db, data, current_user.id)


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


@router.post("/upload-photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.split(".")[-1]
    filename = f"{current_user.id}_{os.urandom(4).hex()}.{ext}"
    file_path = os.path.join(PHOTO_DIR, filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"file_path": f"/photos/{filename}", "filename": filename}


@router.get("/field-configs", response_model=list[FieldConfigResponse])
def list_field_configs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_field_configs(db)


@router.post("/field-configs", response_model=FieldConfigResponse)
def create_field_config_handler(
    data: FieldConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_field_config(db, data)
