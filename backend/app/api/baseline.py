"""AI 个性化基线学习 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import json
import statistics

from app.db import get_session
from app.models import User, HealthRecord, HealthProfile
from app.api.auth import get_current_user
from app.services.llm_service import llm_service
from app.services.anomaly_detector import is_in_safe_zone, SAFE_ZONES
from app.utils import verify_elder_access
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/baseline", tags=["baseline"])


class BaselineLearningRequest(BaseModel):
    elder_id: int
    days: int = 30  # 学习使用的天数


class BaselineResponse(BaseModel):
    user_id: int
    learned_hr_low: float
    learned_hr_high: float
    learned_hr_mean: float
    resting_hr: float
    daily_steps_mean: int
    wake_time: str
    sleep_time: str
    health_summary: str
    risk_factors: List[str]
    personalized_advice: List[str]
    confidence_score: float
    data_quality: str
    last_learning_at: Optional[str]


@router.post("/learn", response_model=BaselineResponse)
async def trigger_baseline_learning(
    request: BaselineLearningRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    触发 AI 基线学习
    分析指定老人过去N天的数据，生成个性化健康画像
    """
    if not verify_elder_access(session, current_user, request.elder_id):
        raise HTTPException(status_code=403, detail="无权访问该用户数据")
    
    # 获取老人信息
    elder = session.get(User, request.elder_id)
    if not elder:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    elder_name = elder.username
    
    # 获取历史数据
    start_date = datetime.now(timezone.utc) - timedelta(days=request.days)
    records = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == request.elder_id)
        .where(HealthRecord.timestamp >= start_date)
        .order_by(HealthRecord.timestamp.asc())
    ).all()
    
    if len(records) < 10:
        raise HTTPException(
            status_code=400, 
            detail=f"数据不足，需要至少10条记录，当前仅有{len(records)}条"
        )
    
    # 统计数据
    records_summary = _calculate_records_summary(records, request.days)
    
    # 调用 AI 分析
    ai_result = await llm_service.analyze_personal_baseline(elder_name, records_summary)
    
    # 保存或更新 HealthProfile
    profile = session.exec(
        select(HealthProfile).where(HealthProfile.user_id == request.elder_id)
    ).first()
    
    if not profile:
        profile = HealthProfile(user_id=request.elder_id)
    
    # 更新 AI 学习结果
    profile.learned_hr_low = ai_result.get('learned_hr_low', records_summary['hr_mean'] - 2*records_summary['hr_std'])
    profile.learned_hr_high = ai_result.get('learned_hr_high', records_summary['hr_mean'] + 2*records_summary['hr_std'])
    profile.learned_hr_mean = records_summary['hr_mean']
    profile.learned_hr_std = records_summary['hr_std']
    profile.resting_hr = ai_result.get('resting_hr', records_summary['hr_mean'] - 5)
    profile.exercise_hr_max = ai_result.get('exercise_hr_max', records_summary['hr_max'])
    
    profile.learned_systolic_mean = records_summary['systolic_mean']
    profile.learned_systolic_std = records_summary.get('systolic_std', 10)
    profile.learned_diastolic_mean = records_summary['diastolic_mean']
    
    profile.wake_time = ai_result.get('wake_time', '06:30')
    profile.sleep_time = ai_result.get('sleep_time', '21:30')
    profile.daily_steps_mean = records_summary['steps_mean']
    profile.daily_steps_std = records_summary.get('steps_std', 1500)
    profile.outdoor_preference = ai_result.get('outdoor_preference', 'morning')
    
    profile.home_stay_ratio = records_summary.get('home_ratio', 0.7)
    profile.frequent_locations = json.dumps(records_summary.get('frequent_locations', []), ensure_ascii=False)
    
    profile.health_summary = ai_result.get('health_summary', '')
    profile.risk_factors = json.dumps(ai_result.get('risk_factors', []), ensure_ascii=False)
    profile.personalized_advice = json.dumps(ai_result.get('personalized_advice', []), ensure_ascii=False)
    
    profile.confidence_score = ai_result.get('confidence_score', 0.5)
    profile.data_quality = _assess_data_quality(len(records), records_summary['days_with_data'])
    
    profile.learning_days = request.days
    profile.total_records_analyzed = len(records)
    profile.last_learning_at = datetime.now(timezone.utc)
    profile.updated_at = datetime.now(timezone.utc)
    
    session.add(profile)
    session.commit()
    session.refresh(profile)
    
    logger.info(f"Baseline learning completed for user {request.elder_id}: {len(records)} records analyzed")
    
    return BaselineResponse(
        user_id=profile.user_id,
        learned_hr_low=profile.learned_hr_low,
        learned_hr_high=profile.learned_hr_high,
        learned_hr_mean=profile.learned_hr_mean,
        resting_hr=profile.resting_hr,
        daily_steps_mean=profile.daily_steps_mean,
        wake_time=profile.wake_time,
        sleep_time=profile.sleep_time,
        health_summary=profile.health_summary,
        risk_factors=json.loads(profile.risk_factors),
        personalized_advice=json.loads(profile.personalized_advice),
        confidence_score=profile.confidence_score,
        data_quality=profile.data_quality,
        last_learning_at=profile.last_learning_at.isoformat() if profile.last_learning_at else None
    )


@router.get("/profile/{elder_id}", response_model=BaselineResponse)
async def get_health_profile(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    获取老人的 AI 健康画像
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="无权访问该用户数据")
    
    profile = session.exec(
        select(HealthProfile).where(HealthProfile.user_id == elder_id)
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=404, 
            detail="尚未生成健康画像，请先触发基线学习"
        )
    
    return BaselineResponse(
        user_id=profile.user_id,
        learned_hr_low=profile.learned_hr_low,
        learned_hr_high=profile.learned_hr_high,
        learned_hr_mean=profile.learned_hr_mean,
        resting_hr=profile.resting_hr,
        daily_steps_mean=profile.daily_steps_mean,
        wake_time=profile.wake_time,
        sleep_time=profile.sleep_time,
        health_summary=profile.health_summary,
        risk_factors=json.loads(profile.risk_factors) if profile.risk_factors else [],
        personalized_advice=json.loads(profile.personalized_advice) if profile.personalized_advice else [],
        confidence_score=profile.confidence_score,
        data_quality=profile.data_quality,
        last_learning_at=profile.last_learning_at.isoformat() if profile.last_learning_at else None
    )


@router.get("/comparison/{elder_id}")
async def get_baseline_comparison(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    获取当前数据与个人基线的对比
    用于前端展示"与平时对比"
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="无权访问该用户数据")
    
    # 获取画像
    profile = session.exec(
        select(HealthProfile).where(HealthProfile.user_id == elder_id)
    ).first()
    
    # 获取最新数据
    latest_record = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == elder_id)
        .order_by(HealthRecord.timestamp.desc())
    ).first()
    
    if not latest_record:
        raise HTTPException(status_code=404, detail="暂无健康数据")
    
    # 如果没有画像，使用默认值
    if not profile:
        return {
            "has_profile": False,
            "current": {
                "heart_rate": latest_record.heart_rate,
                "systolic_bp": latest_record.systolic_bp,
                "diastolic_bp": latest_record.diastolic_bp,
                "steps": latest_record.steps
            },
            "baseline": None,
            "comparison": None,
            "message": "尚未建立个人健康画像，建议触发基线学习以获得个性化分析"
        }
    
    # 计算偏离
    hr = latest_record.heart_rate
    hr_deviation = 0
    hr_status = "正常"
    if hr < profile.learned_hr_low:
        hr_deviation = (profile.learned_hr_low - hr) / profile.learned_hr_low * 100
        hr_status = "偏低"
    elif hr > profile.learned_hr_high:
        hr_deviation = (hr - profile.learned_hr_high) / profile.learned_hr_high * 100
        hr_status = "偏高"
    
    steps_deviation = 0
    if profile.daily_steps_mean > 0:
        # 按当前时间计算预期步数
        current_hour = datetime.now(timezone.utc).hour
        expected_steps = profile.daily_steps_mean * (current_hour / 24)
        if expected_steps > 0:
            steps_deviation = (latest_record.steps - expected_steps) / expected_steps * 100
    
    return {
        "has_profile": True,
        "current": {
            "heart_rate": latest_record.heart_rate,
            "systolic_bp": latest_record.systolic_bp,
            "diastolic_bp": latest_record.diastolic_bp,
            "steps": latest_record.steps
        },
        "baseline": {
            "heart_rate_range": f"{profile.learned_hr_low:.0f}-{profile.learned_hr_high:.0f}",
            "heart_rate_mean": profile.learned_hr_mean,
            "resting_hr": profile.resting_hr,
            "systolic_mean": profile.learned_systolic_mean,
            "diastolic_mean": profile.learned_diastolic_mean,
            "daily_steps_mean": profile.daily_steps_mean
        },
        "comparison": {
            "heart_rate": {
                "deviation_percent": round(hr_deviation, 1),
                "status": hr_status,
                "description": f"当前{hr}bpm，个人正常范围{profile.learned_hr_low:.0f}-{profile.learned_hr_high:.0f}bpm"
            },
            "steps": {
                "deviation_percent": round(steps_deviation, 1),
                "description": f"今日{latest_record.steps}步，日均{profile.daily_steps_mean}步"
            }
        },
        "profile_summary": {
            "health_summary": profile.health_summary,
            "confidence": profile.confidence_score,
            "last_updated": profile.last_learning_at.isoformat() if profile.last_learning_at else None
        }
    }


def _calculate_records_summary(records: list, days: int) -> dict:
    """计算健康记录统计摘要"""
    heart_rates = [r.heart_rate for r in records]
    systolic_bps = [r.systolic_bp for r in records]
    diastolic_bps = [r.diastolic_bp for r in records]
    steps_list = [r.steps for r in records]
    
    # 按天分组计算
    daily_data = {}
    for r in records:
        day = r.timestamp.strftime("%Y-%m-%d") if r.timestamp else "unknown"
        if day not in daily_data:
            daily_data[day] = {"steps": [], "hours": set()}
        daily_data[day]["steps"].append(r.steps)
        if r.timestamp:
            daily_data[day]["hours"].add(r.timestamp.hour)
    
    # 计算活跃时段
    hour_counts = {}
    for r in records:
        if r.timestamp:
            h = r.timestamp.hour
            hour_counts[h] = hour_counts.get(h, 0) + 1
    active_hours = sorted(hour_counts.keys(), key=lambda x: hour_counts[x], reverse=True)[:6]
    
    # 计算位置统计
    home_count = 0
    location_counts = {}
    for r in records:
        in_home = is_in_safe_zone(r.latitude, r.longitude, [SAFE_ZONES[0]])  # 假设第一个是家
        if in_home:
            home_count += 1
        # 简化位置名
        loc_name = "家" if in_home else "外出"
        location_counts[loc_name] = location_counts.get(loc_name, 0) + 1
    
    home_ratio = home_count / len(records) if records else 0.7
    frequent_locations = [k for k, v in sorted(location_counts.items(), key=lambda x: x[1], reverse=True)]
    
    # 计算日均步数
    daily_max_steps = [max(d["steps"]) for d in daily_data.values() if d["steps"]]
    steps_mean = int(statistics.mean(daily_max_steps)) if daily_max_steps else 5000
    steps_std = int(statistics.stdev(daily_max_steps)) if len(daily_max_steps) > 1 else 1500
    
    return {
        "total_records": len(records),
        "days": days,
        "days_with_data": len(daily_data),
        "hr_mean": round(statistics.mean(heart_rates), 1),
        "hr_min": min(heart_rates),
        "hr_max": max(heart_rates),
        "hr_std": round(statistics.stdev(heart_rates), 1) if len(heart_rates) > 1 else 10,
        "systolic_mean": round(statistics.mean(systolic_bps), 1),
        "systolic_min": min(systolic_bps),
        "systolic_max": max(systolic_bps),
        "systolic_std": round(statistics.stdev(systolic_bps), 1) if len(systolic_bps) > 1 else 10,
        "diastolic_mean": round(statistics.mean(diastolic_bps), 1),
        "steps_mean": steps_mean,
        "steps_std": steps_std,
        "active_hours": active_hours,
        "home_ratio": round(home_ratio, 2),
        "frequent_locations": frequent_locations
    }


def _assess_data_quality(total_records: int, days_with_data: int) -> str:
    """评估数据质量"""
    if total_records >= 500 and days_with_data >= 25:
        return "excellent"
    elif total_records >= 200 and days_with_data >= 14:
        return "good"
    elif total_records >= 50 and days_with_data >= 7:
        return "fair"
    else:
        return "insufficient"
