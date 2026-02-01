from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import User, UserResponse
from app.api.auth import get_current_user

router = APIRouter()


@router.get("/users/", response_model=list[UserResponse])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get all users (requires authentication)"""
    users = session.exec(select(User).offset(skip).limit(limit)).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def read_user(
    user_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get a specific user (requires authentication)"""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
