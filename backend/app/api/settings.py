"""用户设置管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.db import get_session
from app.models import UserSettings, User
from app.api.auth import get_current_user
from app.utils import verify_elder_access
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsResponse(BaseModel):
    id: int
    user_id: int
    heart_rate_threshold_high: int
    heart_rate_threshold_low: int
    systolic_bp_threshold_high: int
    systolic_bp_threshold_low: int
    notification_enabled: bool
    emergency_contact: Optional[str]

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    heart_rate_threshold_high: Optional[int] = None
    heart_rate_threshold_low: Optional[int] = None
    systolic_bp_threshold_high: Optional[int] = None
    systolic_bp_threshold_low: Optional[int] = None
    notification_enabled: Optional[bool] = None
    emergency_contact: Optional[str] = None


@router.get("/{elder_id}", response_model=SettingsResponse)
async def get_settings(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取老人的预警阈值设置"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == elder_id)
    ).first()
    
    if not settings:
        # 创建默认设置
        settings = UserSettings(
            user_id=elder_id,
            heart_rate_threshold_high=100,
            heart_rate_threshold_low=50,
            systolic_bp_threshold_high=140,
            systolic_bp_threshold_low=90,
            notification_enabled=True,
            emergency_contact=None
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)
    
    return settings


@router.put("/{elder_id}", response_model=SettingsResponse)
async def update_settings(
    elder_id: int,
    settings_update: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """更新老人的预警阈值设置"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == elder_id)
    ).first()
    
    if not settings:
        # 创建新设置
        settings = UserSettings(user_id=elder_id)
        session.add(settings)
    
    # 更新设置
    if settings_update.heart_rate_threshold_high is not None:
        if not 60 <= settings_update.heart_rate_threshold_high <= 200:
            raise HTTPException(status_code=400, detail="心率上限应在60-200之间")
        settings.heart_rate_threshold_high = settings_update.heart_rate_threshold_high
    
    if settings_update.heart_rate_threshold_low is not None:
        if not 30 <= settings_update.heart_rate_threshold_low <= 100:
            raise HTTPException(status_code=400, detail="心率下限应在30-100之间")
        settings.heart_rate_threshold_low = settings_update.heart_rate_threshold_low
    
    if settings_update.systolic_bp_threshold_high is not None:
        if not 100 <= settings_update.systolic_bp_threshold_high <= 200:
            raise HTTPException(status_code=400, detail="收缩压上限应在100-200之间")
        settings.systolic_bp_threshold_high = settings_update.systolic_bp_threshold_high
    
    if settings_update.systolic_bp_threshold_low is not None:
        if not 70 <= settings_update.systolic_bp_threshold_low <= 120:
            raise HTTPException(status_code=400, detail="收缩压下限应在70-120之间")
        settings.systolic_bp_threshold_low = settings_update.systolic_bp_threshold_low
    
    if settings_update.notification_enabled is not None:
        settings.notification_enabled = settings_update.notification_enabled
    
    if settings_update.emergency_contact is not None:
        settings.emergency_contact = settings_update.emergency_contact
    
    # 验证心率上下限逻辑
    if settings.heart_rate_threshold_low >= settings.heart_rate_threshold_high:
        raise HTTPException(status_code=400, detail="心率下限必须小于上限")
    
    # 验证血压上下限逻辑
    if settings.systolic_bp_threshold_low >= settings.systolic_bp_threshold_high:
        raise HTTPException(status_code=400, detail="血压下限必须小于上限")
    
    session.add(settings)
    session.commit()
    session.refresh(settings)
    
    logger.info(f"Updated settings for elder {elder_id}")
    return settings


@router.post("/{elder_id}/reset", response_model=SettingsResponse)
async def reset_settings(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """重置为默认设置"""
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == elder_id)
    ).first()
    
    if settings:
        settings.heart_rate_threshold_high = 100
        settings.heart_rate_threshold_low = 50
        settings.systolic_bp_threshold_high = 140
        settings.systolic_bp_threshold_low = 90
        settings.notification_enabled = True
    else:
        settings = UserSettings(
            user_id=elder_id,
            heart_rate_threshold_high=100,
            heart_rate_threshold_low=50,
            systolic_bp_threshold_high=140,
            systolic_bp_threshold_low=90,
            notification_enabled=True
        )
        session.add(settings)
    
    session.commit()
    session.refresh(settings)
    
    logger.info(f"Reset settings for elder {elder_id}")
    return settings
