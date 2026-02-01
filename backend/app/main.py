import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlmodel import Session

from app.db import init_db, engine
from app.logger import get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Senior Guardian System API...")
    init_db()
    
    # Initialize seed data
    from app.init_data import init_seed_data
    with Session(engine) as session:
        init_seed_data(session)
    
    yield
    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Senior Guardian System API",
    description="Backend for Senior Guardian System - 老年人安全智能预警系统",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
# For mobile apps (Capacitor/Android), we need to allow all origins
# since the Origin header varies (capacitor://localhost, http://localhost, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when using wildcard origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routers
from app.api import simulation, users, health_records, auth, contacts, safe_zones, devices, settings, ai, baseline

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(simulation.router, prefix="/api", tags=["simulation"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(health_records.router, prefix="/api", tags=["health_records"])
app.include_router(contacts.router, prefix="/api", tags=["contacts"])
app.include_router(safe_zones.router, prefix="/api", tags=["safe_zones"])
app.include_router(devices.router, prefix="/api", tags=["devices"])
app.include_router(settings.router, prefix="/api", tags=["settings"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(baseline.router, prefix="/api", tags=["baseline"])  # AI 个性化基线学习


@app.get("/")
async def root():
    return {
        "message": "Welcome to Senior Guardian System API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "senior-guardian-api"}
