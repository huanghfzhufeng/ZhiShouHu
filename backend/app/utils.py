"""
Common utility functions for Senior Guardian System
"""
from sqlmodel import Session, select
from typing import Optional

from app.models import User, Device, GuardianRelation
from app.logger import get_logger

logger = get_logger(__name__)


def verify_elder_access(session: Session, current_user: User, elder_id: int) -> bool:
    """
    Verify if current user has access to elder's data.
    
    Access is granted if:
    1. User is the elder themselves
    2. User is a guardian with a relation to this elder (via GuardianRelation table)
    3. Fallback: User has elder_id field matching (legacy support)
    
    Args:
        session: Database session
        current_user: The authenticated user making the request
        elder_id: The ID of the elder whose data is being accessed
        
    Returns:
        bool: True if access is allowed, False otherwise
    """
    # Case 1: User is the elder themselves
    if current_user.role == "elder" and current_user.id == elder_id:
        logger.debug(f"Access granted: User {current_user.id} is the elder")
        return True
    
    # Case 2: Check GuardianRelation table (preferred method)
    if current_user.role == "guardian":
        relation = session.exec(
            select(GuardianRelation).where(
                GuardianRelation.guardian_id == current_user.id,
                GuardianRelation.elder_id == elder_id
            )
        ).first()
        
        if relation:
            logger.debug(
                f"Access granted: Guardian {current_user.id} has relation to elder {elder_id}"
            )
            return True
        
        # Case 3: Fallback to legacy elder_id field
        if current_user.elder_id == elder_id:
            logger.debug(
                f"Access granted (legacy): Guardian {current_user.id} "
                f"has elder_id={elder_id}"
            )
            return True
    
    logger.warning(
        f"Access denied: User {current_user.id} (role={current_user.role}) "
        f"cannot access elder {elder_id}"
    )
    return False


def get_device_battery(session: Session, user_id: int) -> int:
    """
    Get battery level from user's active device.
    
    Args:
        session: Database session
        user_id: The user ID to get device for
        
    Returns:
        int: Battery level percentage (0-100), defaults to 85 if no device found
    """
    device = session.exec(
        select(Device).where(
            Device.user_id == user_id,
            Device.is_active == True
        )
    ).first()
    
    if device:
        logger.debug(f"Device found for user {user_id}: battery={device.battery_level}%")
        return device.battery_level
    
    logger.debug(f"No active device found for user {user_id}, using default battery=85")
    return 85


def get_guardian_elders(session: Session, guardian_id: int) -> list[User]:
    """
    Get all elders that a guardian is monitoring.
    
    Args:
        session: Database session
        guardian_id: The guardian's user ID
        
    Returns:
        List of User objects representing elders
    """
    relations = session.exec(
        select(GuardianRelation).where(
            GuardianRelation.guardian_id == guardian_id
        )
    ).all()
    
    elder_ids = [r.elder_id for r in relations]
    
    if not elder_ids:
        # Fallback: check legacy elder_id field
        guardian = session.get(User, guardian_id)
        if guardian and guardian.elder_id:
            elder_ids = [guardian.elder_id]
    
    if not elder_ids:
        return []
    
    elders = session.exec(
        select(User).where(User.id.in_(elder_ids))
    ).all()
    
    return list(elders)


def get_elder_guardians(session: Session, elder_id: int) -> list[User]:
    """
    Get all guardians monitoring a specific elder.
    
    Args:
        session: Database session
        elder_id: The elder's user ID
        
    Returns:
        List of User objects representing guardians
    """
    relations = session.exec(
        select(GuardianRelation).where(
            GuardianRelation.elder_id == elder_id
        )
    ).all()
    
    guardian_ids = [r.guardian_id for r in relations]
    
    if not guardian_ids:
        # Fallback: find guardians with legacy elder_id field
        guardians = session.exec(
            select(User).where(
                User.role == "guardian",
                User.elder_id == elder_id
            )
        ).all()
        return list(guardians)
    
    guardians = session.exec(
        select(User).where(User.id.in_(guardian_ids))
    ).all()
    
    return list(guardians)
