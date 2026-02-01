"""安全区域管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from app.db import get_session
from app.models import SafeZone, User
from app.api.auth import get_current_user
from app.utils import verify_elder_access
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/safe-zones", tags=["safe_zones"])


class SafeZoneCreate(BaseModel):
    zone_name: str
    latitude: float
    longitude: float
    radius: float = 100.0


class SafeZoneUpdate(BaseModel):
    zone_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None
    is_active: Optional[bool] = None


class SafeZoneResponse(BaseModel):
    id: int
    user_id: int
    zone_name: str
    latitude: float
    longitude: float
    radius: float
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/{elder_id}", response_model=List[SafeZoneResponse])
async def get_safe_zones(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取老人的安全区域列表"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(SafeZone).where(
        SafeZone.user_id == elder_id
    ).order_by(SafeZone.created_at)
    
    zones = session.exec(statement).all()
    return zones


@router.post("/{elder_id}", response_model=SafeZoneResponse)
async def create_safe_zone(
    elder_id: int,
    zone: SafeZoneCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """创建新的安全区域"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 检查是否已有同名区域
    existing = session.exec(
        select(SafeZone).where(
            SafeZone.user_id == elder_id,
            SafeZone.zone_name == zone.zone_name
        )
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Zone with this name already exists")
    
    new_zone = SafeZone(
        user_id=elder_id,
        zone_name=zone.zone_name,
        latitude=zone.latitude,
        longitude=zone.longitude,
        radius=zone.radius,
        is_active=True
    )
    
    session.add(new_zone)
    session.commit()
    session.refresh(new_zone)
    
    logger.info(f"Created safe zone '{zone.zone_name}' for elder {elder_id}")
    return new_zone


@router.put("/{zone_id}", response_model=SafeZoneResponse)
async def update_safe_zone(
    zone_id: int,
    zone_update: SafeZoneUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """更新安全区域"""
    zone = session.get(SafeZone, zone_id)
    
    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone not found")
    
    if not verify_elder_access(session, current_user, zone.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update fields
    if zone_update.zone_name is not None:
        zone.zone_name = zone_update.zone_name
    if zone_update.latitude is not None:
        zone.latitude = zone_update.latitude
    if zone_update.longitude is not None:
        zone.longitude = zone_update.longitude
    if zone_update.radius is not None:
        zone.radius = zone_update.radius
    if zone_update.is_active is not None:
        zone.is_active = zone_update.is_active
    
    session.add(zone)
    session.commit()
    session.refresh(zone)
    
    logger.info(f"Updated safe zone {zone_id}")
    return zone


@router.delete("/{zone_id}")
async def delete_safe_zone(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """删除安全区域"""
    zone = session.get(SafeZone, zone_id)
    
    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone not found")
    
    if not verify_elder_access(session, current_user, zone.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    session.delete(zone)
    session.commit()
    
    logger.info(f"Deleted safe zone {zone_id}")
    return {"message": "Safe zone deleted"}


@router.put("/{zone_id}/toggle")
async def toggle_safe_zone(
    zone_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """切换安全区域启用状态"""
    zone = session.get(SafeZone, zone_id)
    
    if not zone:
        raise HTTPException(status_code=404, detail="Safe zone not found")
    
    if not verify_elder_access(session, current_user, zone.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    zone.is_active = not zone.is_active
    session.add(zone)
    session.commit()
    
    return {"message": f"Safe zone {'enabled' if zone.is_active else 'disabled'}", "is_active": zone.is_active}
