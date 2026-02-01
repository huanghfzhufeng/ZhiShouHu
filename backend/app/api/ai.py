"""AI 智能分析 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.db import get_session
from app.models import User, HealthRecord, Alert
from app.api.auth import get_current_user
from app.services.llm_service import llm_service
from app.utils import verify_elder_access
from app.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    elder_id: Optional[int] = None


class ChatResponse(BaseModel):
    reply: str
    suggestions: list[str] = []


class WeeklyReportResponse(BaseModel):
    report: str
    generated_at: str
    has_ai: bool


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    AI 健康助手对话
    用户可以询问关于老人健康状况的问题
    """
    elder_id = request.elder_id or current_user.elder_id
    if not elder_id:
        raise HTTPException(status_code=400, detail="未绑定被监护人")
    
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="无权访问该用户数据")
    
    # 获取老人信息
    elder = session.get(User, elder_id)
    elder_name = elder.username if elder else "老人"
    
    # 获取最新健康数据
    latest_record = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == elder_id)
        .order_by(HealthRecord.timestamp.desc())
    ).first()
    
    # 获取最近7天的统计
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_records = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == elder_id, HealthRecord.timestamp >= week_ago)
    ).all()
    
    # 获取最近告警
    recent_alerts = session.exec(
        select(Alert)
        .where(Alert.user_id == elder_id)
        .order_by(Alert.timestamp.desc())
        .limit(5)
    ).all()
    
    # 构建上下文
    context = _build_context(elder_name, latest_record, recent_records, recent_alerts)
    
    # 调用 LLM
    reply = await llm_service.chat_with_context(request.message, context)
    
    # 生成建议问题
    suggestions = [
        f"{elder_name}今天的血压正常吗？",
        f"{elder_name}这周运动量够吗？",
        "有什么需要注意的健康风险？",
    ]
    
    return ChatResponse(reply=reply, suggestions=suggestions)


@router.get("/weekly-report/{elder_id}", response_model=WeeklyReportResponse)
async def generate_weekly_report(
    elder_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """
    生成 AI 智能周报
    基于过去7天的健康数据生成详细分析报告
    """
    if not verify_elder_access(session, current_user, elder_id):
        raise HTTPException(status_code=403, detail="无权访问该用户数据")
    
    # 获取老人信息
    elder = session.get(User, elder_id)
    elder_name = elder.username if elder else "老人"
    
    # 获取过去7天数据
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    records = session.exec(
        select(HealthRecord)
        .where(HealthRecord.user_id == elder_id, HealthRecord.timestamp >= week_ago)
        .order_by(HealthRecord.timestamp.asc())
    ).all()
    
    # 获取告警
    alerts = session.exec(
        select(Alert)
        .where(Alert.user_id == elder_id, Alert.timestamp >= week_ago)
        .order_by(Alert.timestamp.desc())
    ).all()
    
    if not records:
        return WeeklyReportResponse(
            report="暂无足够数据生成周报，请确保设备正常采集数据。",
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
            has_ai=False
        )
    
    # 计算统计数据
    stats = _calculate_weekly_stats(records, alerts)
    
    # 生成报告
    report = await llm_service.generate_detailed_weekly_report(elder_name, stats)
    
    return WeeklyReportResponse(
        report=report,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        has_ai=llm_service.client is not None
    )


def _build_context(elder_name: str, latest: HealthRecord, records: list, alerts: list) -> dict:
    """构建 LLM 上下文"""
    context = {
        "elder_name": elder_name,
        "current_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    
    if latest:
        context["latest"] = {
            "heart_rate": latest.heart_rate,
            "blood_pressure": f"{latest.systolic_bp}/{latest.diastolic_bp}",
            "steps": latest.steps,
            "time": latest.timestamp.strftime("%H:%M") if latest.timestamp else "未知"
        }
    
    if records:
        heart_rates = [r.heart_rate for r in records]
        steps = [r.steps for r in records]
        context["week_stats"] = {
            "avg_heart_rate": round(sum(heart_rates) / len(heart_rates)),
            "max_heart_rate": max(heart_rates),
            "min_heart_rate": min(heart_rates),
            "total_steps": sum(steps),
            "record_count": len(records)
        }
    
    if alerts:
        context["recent_alerts"] = [
            {"type": a.alert_type, "severity": a.severity, "desc": a.description[:50]}
            for a in alerts[:3]
        ]
    
    return context


def _calculate_weekly_stats(records: list, alerts: list) -> dict:
    """计算周统计数据"""
    heart_rates = [r.heart_rate for r in records]
    systolic_bps = [r.systolic_bp for r in records]
    diastolic_bps = [r.diastolic_bp for r in records]
    steps = [r.steps for r in records]
    
    # 按天分组
    daily_data = {}
    for r in records:
        day = r.timestamp.strftime("%Y-%m-%d") if r.timestamp else "unknown"
        if day not in daily_data:
            daily_data[day] = {"heart_rates": [], "steps": [], "systolic": [], "diastolic": []}
        daily_data[day]["heart_rates"].append(r.heart_rate)
        daily_data[day]["steps"].append(r.steps)
        daily_data[day]["systolic"].append(r.systolic_bp)
        daily_data[day]["diastolic"].append(r.diastolic_bp)
    
    # 计算每日平均
    daily_averages = []
    for day, data in sorted(daily_data.items()):
        daily_averages.append({
            "date": day,
            "avg_hr": round(sum(data["heart_rates"]) / len(data["heart_rates"])),
            "max_hr": max(data["heart_rates"]),
            "total_steps": sum(data["steps"]),
            "avg_bp": f"{round(sum(data['systolic'])/len(data['systolic']))}/{round(sum(data['diastolic'])/len(data['diastolic']))}"
        })
    
    # 异常统计
    high_hr_count = len([h for h in heart_rates if h > 100])
    low_hr_count = len([h for h in heart_rates if h < 50])
    high_bp_count = len([s for s in systolic_bps if s > 140])
    
    return {
        "total_records": len(records),
        "days_with_data": len(daily_data),
        "avg_heart_rate": round(sum(heart_rates) / len(heart_rates)),
        "max_heart_rate": max(heart_rates),
        "min_heart_rate": min(heart_rates),
        "avg_systolic": round(sum(systolic_bps) / len(systolic_bps)),
        "avg_diastolic": round(sum(diastolic_bps) / len(diastolic_bps)),
        "total_steps": sum(steps),
        "avg_daily_steps": round(sum(steps) / len(daily_data)) if daily_data else 0,
        "high_hr_count": high_hr_count,
        "low_hr_count": low_hr_count,
        "high_bp_count": high_bp_count,
        "alert_count": len(alerts),
        "high_alerts": len([a for a in alerts if a.severity == "high"]),
        "daily_averages": daily_averages
    }
