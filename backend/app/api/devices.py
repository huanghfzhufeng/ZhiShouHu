"""设备管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app.db import get_session
from app.models import Device, User
from app.api.auth import get_current_user
from app.utils import verify_elder_access
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceResponse(BaseModel):
    id: int
    user_id: int
    device_id: str
    device_type: str
    battery_level: int
    last_sync: datetime
    is_active: bool

    class Config:
        from_attributes = True


class DeviceStatusResponse(BaseModel):
    """设备状态响应，包含额外的计算字段"""
    id: int
    device_id: str
    device_type: str
    battery_level: int
    last_sync: datetime
    is_active: bool
    is_low_battery: bool
    sync_status: str  # "online", "offline", "warning"
    last_sync_text: str


@router.get("/{elder_id}", response_model=List[DeviceResponse])
async def get_devices(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取老人的设备列表"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Device).where(
        Device.user_id == elder_id
    ).order_by(Device.is_active.desc(), Device.last_sync.desc())
    
    devices = session.exec(statement).all()
    return devices


@router.get("/{elder_id}/status", response_model=DeviceStatusResponse)
async def get_device_status(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取老人的主要设备状态（用于首页展示）"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # 获取活跃设备
    device = session.exec(
        select(Device).where(
            Device.user_id == elder_id,
            Device.is_active == True
        )
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="No active device found")
    
    # 计算同步状态
    now = datetime.now(timezone.utc)
    last_sync = device.last_sync
    if last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=timezone.utc)
    
    time_diff = now - last_sync
    minutes_diff = time_diff.total_seconds() / 60
    
    # 确定同步状态
    if minutes_diff < 5:
        sync_status = "online"
        last_sync_text = "刚刚"
    elif minutes_diff < 30:
        sync_status = "online"
        last_sync_text = f"{int(minutes_diff)}分钟前"
    elif minutes_diff < 60:
        sync_status = "warning"
        last_sync_text = f"{int(minutes_diff)}分钟前"
    elif minutes_diff < 1440:  # 24小时
        sync_status = "warning"
        hours = int(minutes_diff / 60)
        last_sync_text = f"{hours}小时前"
    else:
        sync_status = "offline"
        days = int(minutes_diff / 1440)
        last_sync_text = f"{days}天前"
    
    return DeviceStatusResponse(
        id=device.id,
        device_id=device.device_id,
        device_type=device.device_type,
        battery_level=device.battery_level,
        last_sync=device.last_sync,
        is_active=device.is_active,
        is_low_battery=device.battery_level < 20,
        sync_status=sync_status,
        last_sync_text=last_sync_text
    )


@router.put("/{device_id}/battery")
async def update_battery(
    device_id: int,
    battery_level: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """更新设备电量（模拟设备上报）"""
    device = session.get(Device, device_id)
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not verify_elder_access(session, current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not 0 <= battery_level <= 100:
        raise HTTPException(status_code=400, detail="Battery level must be between 0 and 100")
    
    device.battery_level = battery_level
    device.last_sync = datetime.now(timezone.utc)
    session.add(device)
    session.commit()
    
    return {"message": "Battery level updated", "battery_level": battery_level}


@router.put("/{device_id}/sync")
async def sync_device(
    device_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """更新设备同步时间"""
    device = session.get(Device, device_id)
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not verify_elder_access(session, current_user, device.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    device.last_sync = datetime.now(timezone.utc)
    session.add(device)
    session.commit()
    
    return {"message": "Device synced", "last_sync": device.last_sync}
