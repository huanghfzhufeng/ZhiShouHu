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
# For mobile apps (Capacitor/Android), we need to allow specific origins or use regex.
# Wildcard "*" with allow_credentials=True is not allowed.
# We will use allow_origin_regex to match localhost and the server IP.

origins = [
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "http://localhost:5173",  # Local dev
    "http://localhost:8100",  # Ionic/Capacitor dev
]

# Add Env var origins
env_origins = os.getenv("CORS_ORIGINS", "")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[], # "allow_origins" must be empty if "allow_origin_regex" is used with "allow_credentials=True"
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex="https?://.*", # Allow http/https from anywhere
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
