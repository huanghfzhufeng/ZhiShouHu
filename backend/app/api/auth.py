from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
import os

from app.db import get_session
from app.models import User, UserRegister, UserLogin, Token, UserResponse

router = APIRouter()

# Security config
_default_secret = "dev-only-secret-key-DO-NOT-USE-IN-PRODUCTION"
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import warnings
    warnings.warn(
        "SECRET_KEY not set! Using insecure default. "
        "Set SECRET_KEY environment variable in production!",
        RuntimeWarning
    )
    SECRET_KEY = _default_secret

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = session.get(User, int(user_id))
    if user is None:
        raise credentials_exception
    return user


@router.post("/auth/register", response_model=UserResponse)
def register(user_data: UserRegister, session: Session = Depends(get_session)):
    """Register a new user"""
    # Check if phone already exists
    existing_user = session.exec(
        select(User).where(User.phone == user_data.phone)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        phone=user_data.phone,
        password_hash=hashed_password,
        role=user_data.role,
        elder_id=user_data.elder_id
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


@router.post("/auth/login", response_model=Token)
def login(user_data: UserLogin, session: Session = Depends(get_session)):
    """Login and get access token"""
    user = session.exec(
        select(User).where(User.phone == user_data.phone)
    ).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token)


@router.post("/auth/login/form", response_model=Token)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    """Login using OAuth2 form (for Swagger UI)"""
    user = session.exec(
        select(User).where(User.phone == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token)


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current logged-in user info"""
    return current_user


@router.get("/auth/elder", response_model=UserResponse)
def get_my_elder(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get the elder info that current guardian is monitoring"""
    if current_user.role != "guardian":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only guardians can access this endpoint"
        )
    
    if not current_user.elder_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No elder associated with this guardian"
        )
    
    elder = session.get(User, current_user.elder_id)
    if not elder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Elder not found"
        )
    return elder


@router.get("/auth/elders", response_model=list[UserResponse])
def get_my_elders(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get all elders that current guardian is monitoring.
    Returns list of elders from GuardianRelation table, falls back to elder_id.
    """
    if current_user.role != "guardian":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only guardians can access this endpoint"
        )
    
    from app.utils import get_guardian_elders
    elders = get_guardian_elders(session, current_user.id)
    
    return elders
