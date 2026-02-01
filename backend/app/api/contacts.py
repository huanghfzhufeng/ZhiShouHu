"""紧急联系人 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from app.db import get_session
from app.models import EmergencyContact, User
from app.api.auth import get_current_user
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/contacts", tags=["contacts"])


class ContactCreate(BaseModel):
    name: str
    phone: str
    relation: str = "家人"


class ContactResponse(BaseModel):
    id: int
    name: str
    phone: str
    relation: str
    is_primary: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ContactResponse])
async def get_contacts(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取当前用户的紧急联系人列表"""
    statement = select(EmergencyContact).where(
        EmergencyContact.user_id == current_user.id
    ).order_by(EmergencyContact.is_primary.desc(), EmergencyContact.created_at)
    
    contacts = session.exec(statement).all()
    return contacts


@router.post("/", response_model=ContactResponse)
async def add_contact(
    contact: ContactCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """添加紧急联系人"""
    # 检查是否已有联系人，如果没有则设为首要联系人
    existing = session.exec(
        select(EmergencyContact).where(EmergencyContact.user_id == current_user.id)
    ).first()
    
    is_primary = existing is None
    
    new_contact = EmergencyContact(
        user_id=current_user.id,
        name=contact.name,
        phone=contact.phone,
        relation=contact.relation,
        is_primary=is_primary
    )
    
    session.add(new_contact)
    session.commit()
    session.refresh(new_contact)
    
    logger.info(f"User {current_user.id} added emergency contact: {contact.name}")
    return new_contact


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """删除紧急联系人"""
    contact = session.get(EmergencyContact, contact_id)
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if contact.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this contact")
    
    was_primary = contact.is_primary
    session.delete(contact)
    session.commit()
    
    # 如果删除的是首要联系人，将下一个联系人设为首要
    if was_primary:
        next_contact = session.exec(
            select(EmergencyContact).where(EmergencyContact.user_id == current_user.id)
        ).first()
        if next_contact:
            next_contact.is_primary = True
            session.add(next_contact)
            session.commit()
    
    logger.info(f"User {current_user.id} deleted emergency contact: {contact_id}")
    return {"message": "Contact deleted"}


@router.get("/primary", response_model=Optional[ContactResponse])
async def get_primary_contact(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取首要紧急联系人（用于一键呼叫）"""
    contact = session.exec(
        select(EmergencyContact).where(
            EmergencyContact.user_id == current_user.id,
            EmergencyContact.is_primary == True
        )
    ).first()
    
    if not contact:
        # 如果没有首要联系人，返回第一个联系人
        contact = session.exec(
            select(EmergencyContact).where(EmergencyContact.user_id == current_user.id)
        ).first()
    
    return contact


@router.put("/{contact_id}/set-primary")
async def set_primary_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """设置首要联系人"""
    contact = session.get(EmergencyContact, contact_id)
    
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    if contact.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # 取消其他联系人的首要状态
    other_contacts = session.exec(
        select(EmergencyContact).where(
            EmergencyContact.user_id == current_user.id,
            EmergencyContact.is_primary == True
        )
    ).all()
    
    for c in other_contacts:
        c.is_primary = False
        session.add(c)
    
    # 设置当前联系人为首要
    contact.is_primary = True
    session.add(contact)
    session.commit()
    
    return {"message": "Primary contact updated"}
