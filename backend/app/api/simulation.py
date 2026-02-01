from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List
from datetime import datetime, timezone
import random

from app.db import get_session
from app.models import HealthRecord, Alert, HealthDataResponse, User
from app.services.llm_service import llm_service
from app.services.anomaly_detector import AnomalyDetector
from app.api.auth import get_current_user
from app.utils import verify_elder_access, get_device_battery
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/simulation/inject-anomaly")
async def inject_anomaly(
    user_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Simulate an anomaly event: High heart rate + Leaving safe zone.
    Creates a real record in the database and triggers analysis.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    logger.info(f"Injecting anomaly for user {user_id}")
    
    # 1. Create abnormal health record (outside safe zones)
    record = HealthRecord(
        user_id=user_id,
        heart_rate=random.randint(110, 130),
        systolic_bp=random.randint(145, 160),
        diastolic_bp=random.randint(90, 100),
        steps=random.randint(7000, 9000),
        latitude=30.2900,  # Outside safe zones
        longitude=120.1800,
        timestamp=datetime.now(timezone.utc)
    )
    
    # Save to database
    session.add(record)
    session.commit()
    session.refresh(record)
    
    # 2. Run rule-based anomaly detection (pass session for DB access)
    detector = AnomalyDetector(session)
    analysis = detector.comprehensive_analysis(record)
    
    # 3. Enhance with LLM Situational Analysis
    llm_result = await llm_service.analyze_health_data({
        "heart_rate": record.heart_rate,
        "systolic_bp": record.systolic_bp,
        "diastolic_bp": record.diastolic_bp,
        "steps": record.steps,
        "location": analysis["location_analysis"]["location_name"],
        "activity": analysis["activity_analysis"]["activity"]
    })
    
    situation_report = llm_result.get("analysis_report", analysis["summary_message"])
    
    # 4. Create and save Alert
    alert = Alert(
        user_id=user_id,
        alert_type="anomaly_detection",
        severity="high",
        description=situation_report,
        is_read=False,
        timestamp=datetime.now(timezone.utc)
    )
    session.add(alert)
    session.commit()
    session.refresh(alert)
    
    # 5. Build response for frontend
    battery = get_device_battery(session, user_id)
    health_response = detector.build_health_response(record, analysis, battery)
    # Use LLM message in response
    health_response.message = situation_report
    
    return {
        "status": "simulation_triggered",
        "data": {
            "heart_rate": record.heart_rate,
            "systolic_bp": record.systolic_bp,
            "diastolic_bp": record.diastolic_bp,
            "steps": record.steps,
            "latitude": record.latitude,
            "longitude": record.longitude
        },
        "analysis": {
            "risk_assessment": analysis["overall_risk"],
            "analysis_report": analysis["summary_message"],
            "anomaly_count": analysis["anomaly_count"]
        },
        "alert": {
            "id": alert.id,
            "severity": alert.severity,
            "description": alert.description
        },
        "health_response": health_response
    }


@router.post("/simulation/reset")
async def reset_simulation(
    user_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Reset to normal state by creating a normal health record.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    logger.info(f"Resetting simulation for user {user_id}")
    
    # Create normal health record (inside safe zones - park)
    record = HealthRecord(
        user_id=user_id,
        heart_rate=random.randint(68, 78),
        systolic_bp=random.randint(115, 125),
        diastolic_bp=random.randint(75, 85),
        steps=random.randint(3000, 4500),
        latitude=30.2761,  # Park location
        longitude=120.1581,
        timestamp=datetime.now(timezone.utc)
    )
    
    session.add(record)
    session.commit()
    session.refresh(record)
    
    detector = AnomalyDetector(session)
    analysis = detector.comprehensive_analysis(record)
    battery = get_device_battery(session, user_id)
    health_response = detector.build_health_response(record, analysis, battery)
    
    return {
        "status": "reset_complete",
        "health_response": health_response
    }


@router.get("/simulation/weekly-report/{user_id}")
async def get_weekly_report(
    user_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Generate a mock weekly report using LLM.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    report_content = await llm_service.generate_weekly_report(user_id)
    return {"report_markdown": report_content}
