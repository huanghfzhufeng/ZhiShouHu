from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.db import get_session
from app.models import HealthRecord, Alert, HealthDataResponse, AlertResponse, User, HealthRecordCreate
from app.api.auth import get_current_user
from app.services.anomaly_detector import AnomalyDetector
from app.services.llm_service import llm_service
from app.utils import verify_elder_access, get_device_battery
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/health-records/", response_model=HealthRecord)
def create_health_record(
    record_data: HealthRecordCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Create a new health record (requires authentication)"""
    if not verify_elder_access(session, current_user, record_data.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    record = HealthRecord(**record_data.model_dump())
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.get("/health-records/{user_id}", response_model=List[HealthRecord])
def read_health_records(
    user_id: int, 
    limit: int = 50, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get health records for a user (requires authentication)"""
    if not verify_elder_access(session, current_user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(HealthRecord).where(HealthRecord.user_id == user_id).order_by(HealthRecord.timestamp.desc()).limit(limit)
    records = session.exec(statement).all()
    return records


@router.get("/health-records/latest/{user_id}", response_model=HealthRecord)
def read_latest_record(
    user_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """Get latest health record (requires authentication)"""
    if not verify_elder_access(session, current_user, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(HealthRecord).where(HealthRecord.user_id == user_id).order_by(HealthRecord.timestamp.desc())
    record = session.exec(statement).first()
    if not record:
        raise HTTPException(status_code=404, detail="No health records found")
    return record


@router.get("/realtime-status/{elder_id}", response_model=HealthDataResponse)
async def get_realtime_status(
    elder_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get real-time health status with AI multi-dimension analysis.
    Uses AI-learned personal baseline for personalized anomaly detection.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get elder info
    elder = session.get(User, elder_id)
    elder_name = elder.username if elder else "老人"
    
    # Get the latest health record
    statement = select(HealthRecord).where(
        HealthRecord.user_id == elder_id
    ).order_by(HealthRecord.timestamp.desc())
    record = session.exec(statement).first()
    
    # Get battery from device
    battery = get_device_battery(session, elder_id)
    
    if not record:
        return HealthDataResponse(
            status="safe",
            heartRate=72,
            bloodPressure="120/80",
            stepCount=0,
            location="家",
            activity="休息",
            riskLevel="低",
            battery=battery,
            lastUpdate="刚刚",
            message="正在初始化监护系统..."
        )
    
    # Get historical records for trend analysis
    historical = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == elder_id)
        .order_by(HealthRecord.timestamp.desc())
        .limit(10)
    ).all()
    
    # Perform rule-based analysis with AI baseline support
    detector = AnomalyDetector(session)
    analysis = detector.comprehensive_analysis(record, historical)
    
    # Get baseline context for AI multi-dimension analysis
    baseline_context = analysis.get("baseline_context", {})
    
    # Calculate heart rate trend from historical data
    hr_trend = "平稳"
    if len(historical) >= 3:
        recent_hrs = [r.heart_rate for r in historical[:3]]
        if all(recent_hrs[i] > recent_hrs[i+1] for i in range(len(recent_hrs)-1)):
            hr_trend = "持续上升"
        elif all(recent_hrs[i] < recent_hrs[i+1] for i in range(len(recent_hrs)-1)):
            hr_trend = "持续下降"
    
    # Determine location status
    location_status = "正常" if not analysis["location_analysis"]["is_anomaly"] else "偏离常规区域"
    
    # Prepare current data and context for AI multi-dimension analysis
    current_data = {
        "heart_rate": record.heart_rate,
        "systolic_bp": record.systolic_bp,
        "diastolic_bp": record.diastolic_bp,
        "steps": record.steps,
        "location": analysis["location_analysis"]["location_name"]
    }
    
    context = {
        "elder_name": elder_name,
        "current_hour": record.timestamp.hour if record.timestamp else 12,
        "hr_trend": hr_trend,
        "location_status": location_status
    }
    
    # Call AI multi-dimension analysis
    ai_analysis = await llm_service.multi_dimension_analysis(
        current_data, 
        baseline_context, 
        context
    )
    
    # Build response
    response = detector.build_health_response(record, analysis, battery)
    
    # Override message with AI explanation if available
    if ai_analysis.get("explanation"):
        response.message = ai_analysis["explanation"]
    
    # If there's anomaly, update risk level from AI analysis
    if analysis["anomaly_count"] > 0 and ai_analysis.get("risk_level"):
        risk_map = {"低": "低", "中": "中", "高": "高", "紧急": "高"}
        response.riskLevel = risk_map.get(ai_analysis["risk_level"], response.riskLevel)
    
    return response


@router.get("/alerts/{elder_id}", response_model=List[AlertResponse])
def get_alerts(
    elder_id: int, 
    limit: int = 20, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get alerts for an elder, sorted by most recent.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Alert).where(
        Alert.user_id == elder_id
    ).order_by(Alert.timestamp.desc()).limit(limit)
    
    alerts = session.exec(statement).all()
    return alerts


@router.get("/weekly-stats/{elder_id}")
def get_weekly_stats(
    elder_id: int, 
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get weekly health statistics for charts.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    statement = select(HealthRecord).where(
        HealthRecord.user_id == elder_id,
        HealthRecord.timestamp >= week_ago
    ).order_by(HealthRecord.timestamp.asc())
    
    records = session.exec(statement).all()
    
    # Group by day and calculate daily averages
    daily_stats = {}
    for record in records:
        day_key = record.timestamp.strftime("%Y-%m-%d")
        if day_key not in daily_stats:
            daily_stats[day_key] = {
                "heart_rates": [],
                "steps": [],
                "systolic_bps": []
            }
        daily_stats[day_key]["heart_rates"].append(record.heart_rate)
        daily_stats[day_key]["steps"].append(record.steps)
        daily_stats[day_key]["systolic_bps"].append(record.systolic_bp)
    
    # Calculate averages
    result = []
    for day, stats in sorted(daily_stats.items()):
        result.append({
            "date": day,
            "avg_heart_rate": sum(stats["heart_rates"]) // len(stats["heart_rates"]),
            "max_heart_rate": max(stats["heart_rates"]),
            "total_steps": sum(stats["steps"]),
            "avg_systolic_bp": sum(stats["systolic_bps"]) // len(stats["systolic_bps"])
        })
    
    return {
        "days": result,
        "summary": {
            "total_records": len(records),
            "anomaly_days": sum(1 for d in result if d["max_heart_rate"] > 100)
        }
    }


@router.get("/my-elder-status", response_model=HealthDataResponse)
async def get_my_elder_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get real-time status for the elder that current guardian is monitoring.
    Requires authentication.
    """
    if current_user.role != "guardian":
        raise HTTPException(
            status_code=400,
            detail="Only guardians can access this endpoint"
        )
    
    if not current_user.elder_id:
        raise HTTPException(
            status_code=404,
            detail="No elder associated with this guardian"
        )
    
    return await get_realtime_status(current_user.elder_id, current_user, session)


@router.get("/my-elder-stats")
def get_my_elder_stats(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get weekly statistics for the elder that current guardian is monitoring.
    Requires authentication.
    """
    if current_user.role != "guardian":
        raise HTTPException(
            status_code=400,
            detail="Only guardians can access this endpoint"
        )
    
    if not current_user.elder_id:
        raise HTTPException(
            status_code=404,
            detail="No elder associated with this guardian"
        )
    
    return get_weekly_stats(current_user.elder_id, current_user, session)


@router.get("/my-elder-alerts", response_model=List[AlertResponse])
def get_my_elder_alerts(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get alerts for the elder that current guardian is monitoring.
    Requires authentication.
    """
    if current_user.role != "guardian":
        raise HTTPException(
            status_code=400,
            detail="Only guardians can access this endpoint"
        )
    
    if not current_user.elder_id:
        raise HTTPException(
            status_code=404,
            detail="No elder associated with this guardian"
        )
    
    return get_alerts(current_user.elder_id, limit, current_user, session)


@router.get("/daily-timeline/{elder_id}")
def get_daily_timeline(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get today's activity timeline based on real health records.
    Returns key events throughout the day.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get today's records
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    statement = select(HealthRecord).where(
        HealthRecord.user_id == elder_id,
        HealthRecord.timestamp >= today_start
    ).order_by(HealthRecord.timestamp.asc())
    
    records = session.exec(statement).all()
    
    detector = AnomalyDetector(session)
    timeline = []
    
    if not records:
        # Return default timeline if no records today
        return {
            "timeline": [
                {
                    "time": "--:--",
                    "title": "暂无数据",
                    "normal": True,
                    "heartRate": 0,
                    "bloodPressure": "--/--",
                    "description": "今日暂无健康记录",
                    "predicted": False
                }
            ],
            "has_data": False
        }
    
    # Group records by hour to create timeline events
    hourly_records = {}
    for record in records:
        hour_key = record.timestamp.strftime("%H:00")
        if hour_key not in hourly_records:
            hourly_records[hour_key] = []
        hourly_records[hour_key].append(record)
    
    # Create timeline events from hourly groups
    for hour, hour_records in sorted(hourly_records.items()):
        # Use the last record of each hour as representative
        record = hour_records[-1]
        analysis = detector.comprehensive_analysis(record)
        
        location_name = analysis["location_analysis"]["location_name"]
        activity = analysis["activity_analysis"]["activity"]
        is_anomaly = analysis["anomaly_count"] > 0
        
        # Generate title based on location and activity
        if is_anomaly:
            title = f"异常：{analysis['summary_message'][:20]}..."
        elif location_name == "家":
            title = "在家中"
        elif "公园" in location_name:
            title = "前往公园散步"
        elif "菜市场" in location_name:
            title = "前往菜市场"
        else:
            title = f"在{location_name}"
        
        timeline.append({
            "time": record.timestamp.strftime("%H:%M"),
            "title": title,
            "normal": not is_anomaly,
            "heartRate": record.heart_rate,
            "bloodPressure": f"{record.systolic_bp}/{record.diastolic_bp}",
            "description": analysis["summary_message"],
            "predicted": False,
            "location": location_name,
            "activity": activity,
            "steps": record.steps
        })
    
    # Add predicted event if before evening
    current_hour = now.hour
    if current_hour < 18 and timeline:
        timeline.append({
            "time": "~18:00",
            "title": "预计返回家中",
            "normal": True,
            "predicted": True
        })
    
    return {
        "timeline": timeline,
        "has_data": True,
        "total_records": len(records)
    }


@router.put("/alerts/{alert_id}/read")
def mark_alert_as_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Mark a single alert as read.
    Requires authentication.
    """
    alert = session.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if not verify_elder_access(session, current_user, alert.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    alert.is_read = True
    session.add(alert)
    session.commit()
    
    return {"message": "Alert marked as read", "alert_id": alert_id}


@router.put("/alerts/{elder_id}/read-all")
def mark_all_alerts_as_read(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Mark all alerts for an elder as read.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Alert).where(
        Alert.user_id == elder_id,
        Alert.is_read == False
    )
    alerts = session.exec(statement).all()
    
    for alert in alerts:
        alert.is_read = True
        session.add(alert)
    
    session.commit()
    
    return {"message": f"Marked {len(alerts)} alerts as read"}


@router.get("/alerts/{elder_id}/unread-count")
def get_unread_alert_count(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Get count of unread alerts for an elder.
    Requires authentication.
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    statement = select(Alert).where(
        Alert.user_id == elder_id,
        Alert.is_read == False
    )
    alerts = session.exec(statement).all()
    
    return {"unread_count": len(alerts)}


@router.get("/behavior-score/{elder_id}")
def get_behavior_score(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    Calculate today's behavior score based on real health data.
    Score is calculated from:
    - Heart rate stability (30%)
    - Blood pressure stability (30%)
    - Activity level (20%)
    - Location compliance (20%)
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get today's records
    statement = select(HealthRecord).where(
        HealthRecord.user_id == elder_id,
        HealthRecord.timestamp >= today_start
    ).order_by(HealthRecord.timestamp.desc())
    
    records = session.exec(statement).all()
    
    if not records:
        return {
            "score": 0,
            "status": "无数据",
            "description": "今日暂无健康数据，无法计算评分",
            "breakdown": {
                "heart_rate_score": 0,
                "blood_pressure_score": 0,
                "activity_score": 0,
                "location_score": 0
            },
            "has_data": False
        }
    
    detector = AnomalyDetector(session)
    
    # Calculate component scores
    hr_scores = []
    bp_scores = []
    loc_scores = []
    anomaly_count = 0
    
    for record in records:
        analysis = detector.comprehensive_analysis(record)
        
        # Heart rate score (100 if normal, 50 if abnormal)
        hr_scores.append(100 if not analysis["heart_rate_analysis"]["is_anomaly"] else 50)
        
        # Blood pressure score
        bp_scores.append(100 if not analysis["blood_pressure_analysis"]["is_anomaly"] else 50)
        
        # Location score
        loc_scores.append(100 if not analysis["location_analysis"]["is_anomaly"] else 30)
        
        if analysis["anomaly_count"] > 0:
            anomaly_count += 1
    
    # Calculate averages
    hr_avg = sum(hr_scores) / len(hr_scores) if hr_scores else 0
    bp_avg = sum(bp_scores) / len(bp_scores) if bp_scores else 0
    loc_avg = sum(loc_scores) / len(loc_scores) if loc_scores else 0
    
    # Activity score based on steps (target: 3000-6000 steps)
    total_steps = records[0].steps if records else 0
    if total_steps >= 3000 and total_steps <= 8000:
        activity_score = 100
    elif total_steps > 8000:
        activity_score = 80  # Too much activity
    elif total_steps >= 1000:
        activity_score = 70
    else:
        activity_score = 50  # Too little activity
    
    # Calculate final score (weighted average)
    final_score = int(
        hr_avg * 0.30 +
        bp_avg * 0.30 +
        activity_score * 0.20 +
        loc_avg * 0.20
    )
    
    # Determine status
    if final_score >= 85:
        status = "状态优秀"
        description = "老人今日作息规律，各项生理指标稳定，生活状态良好。"
    elif final_score >= 70:
        status = "状态良好"
        description = "老人今日整体状态正常，部分指标有轻微波动，建议持续关注。"
    elif final_score >= 50:
        status = "需关注"
        description = f"今日检测到 {anomaly_count} 次异常记录，建议联系老人确认情况。"
    else:
        status = "需立即关注"
        description = f"今日检测到多次异常，包括生理指标和位置偏离，请立即确认老人安全。"
    
    return {
        "score": final_score,
        "status": status,
        "description": description,
        "breakdown": {
            "heart_rate_score": int(hr_avg),
            "blood_pressure_score": int(bp_avg),
            "activity_score": activity_score,
            "location_score": int(loc_avg)
        },
        "anomaly_count": anomaly_count,
        "total_records": len(records),
        "has_data": True
    }
