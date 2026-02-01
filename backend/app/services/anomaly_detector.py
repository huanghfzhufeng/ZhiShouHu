"""
Multi-modal Anomaly Detection Service
Simplified rule-based engine for detecting anomalies in health and location data
"""
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select
from math import radians, sin, cos, sqrt, atan2

from app.models import HealthRecord, Alert, HealthDataResponse, SafeZone, UserSettings, Device, HealthProfile


# Default thresholds
HEART_RATE_HIGH = 100
HEART_RATE_LOW = 50
BP_SYSTOLIC_HIGH = 140
BP_SYSTOLIC_LOW = 90
BP_DIASTOLIC_HIGH = 90
LOCATION_DEVIATION_METERS = 1000  # 1km

# Known safe zones (lat, lng, radius_meters)
SAFE_ZONES = [
    {"name": "家", "lat": 30.2741, "lng": 120.1551, "radius": 200},
    {"name": "幸福社区公园", "lat": 30.2761, "lng": 120.1581, "radius": 300},
    {"name": "幸福社区菜市场", "lat": 30.2721, "lng": 120.1531, "radius": 200},
    {"name": "社区医院", "lat": 30.2701, "lng": 120.1601, "radius": 200},
]


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in meters"""
    R = 6371000  # Earth radius in meters
    
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


def get_location_name(lat: float, lng: float, safe_zones: List[Dict] = None) -> str:
    """Get location name based on coordinates"""
    zones = safe_zones or SAFE_ZONES
    for zone in zones:
        distance = haversine_distance(lat, lng, zone["lat"], zone["lng"])
        if distance <= zone["radius"]:
            return zone["name"]
    return "未知区域"


def is_in_safe_zone(lat: float, lng: float, safe_zones: List[Dict] = None) -> bool:
    """Check if location is within any safe zone"""
    zones = safe_zones or SAFE_ZONES
    for zone in zones:
        distance = haversine_distance(lat, lng, zone["lat"], zone["lng"])
        if distance <= zone["radius"]:
            return True
    return False


class AnomalyDetector:
    """Multi-modal anomaly detection engine with AI baseline support"""
    
    def __init__(self, session: Session = None):
        self.anomalies = []
        self.session = session
        self._profile_cache = {}  # 缓存AI画像
    
    def _get_health_profile(self, user_id: int) -> Optional[HealthProfile]:
        """Get AI-learned health profile from database"""
        if user_id in self._profile_cache:
            return self._profile_cache[user_id]
        
        if not self.session:
            return None
        try:
            profile = self.session.exec(
                select(HealthProfile).where(HealthProfile.user_id == user_id)
            ).first()
            if profile:
                self._profile_cache[user_id] = profile
            return profile
        except Exception as e:
            print(f"Error fetching health profile: {e}")
            return None
    
    def _get_user_settings(self, user_id: int) -> Optional[UserSettings]:
        """Get user-specific settings from database"""
        if not self.session:
            return None
        try:
            return self.session.exec(
                select(UserSettings).where(UserSettings.user_id == user_id)
            ).first()
        except Exception as e:
            print(f"Error fetching user settings: {e}")
            return None
    
    def _get_safe_zones(self, user_id: int) -> List[Dict]:
        """Get user-specific safe zones from database"""
        if not self.session:
            return SAFE_ZONES
        try:
            zones = self.session.exec(
                select(SafeZone).where(
                    SafeZone.user_id == user_id,
                    SafeZone.is_active == True
                )
            ).all()
            if not zones:
                return SAFE_ZONES
            return [
                {
                    "name": z.zone_name,
                    "lat": z.latitude,
                    "lng": z.longitude,
                    "radius": z.radius
                } for z in zones
            ]
        except Exception as e:
            print(f"Error fetching safe zones: {e}")
            return SAFE_ZONES
    
    def analyze_heart_rate(self, heart_rate: int, user_id: int = None) -> Dict:
        """Analyze heart rate for anomalies using AI baseline if available"""
        # Priority: AI Profile > User Settings > Default
        hr_high = HEART_RATE_HIGH
        hr_low = HEART_RATE_LOW
        hr_baseline_mean = 72
        using_ai_baseline = False
        
        if user_id:
            # 优先使用AI学习的基线
            profile = self._get_health_profile(user_id)
            if profile and profile.confidence_score > 0.3:
                hr_high = profile.learned_hr_high
                hr_low = profile.learned_hr_low
                hr_baseline_mean = profile.learned_hr_mean
                using_ai_baseline = True
            else:
                # 回退到用户设置
                settings = self._get_user_settings(user_id)
                if settings:
                    hr_high = settings.heart_rate_threshold_high
                    hr_low = settings.heart_rate_threshold_low
        
        result = {
            "is_anomaly": False,
            "severity": "normal",
            "message": "心率正常",
            "using_ai_baseline": using_ai_baseline,
            "baseline_range": f"{hr_low:.0f}-{hr_high:.0f}"
        }
        
        if heart_rate > hr_high:
            deviation = (heart_rate - hr_high) / hr_high * 100
            result["is_anomaly"] = True
            result["severity"] = "high" if deviation > 20 else "warning"
            if using_ai_baseline:
                result["message"] = f"心率{heart_rate}bpm，超出个人基线上限({hr_high:.0f}bpm) {deviation:.0f}%"
            else:
                result["message"] = f"心率偏高 ({heart_rate}bpm)，建议关注是否为运动或情绪波动"
            result["deviation_percent"] = round(deviation, 1)
        elif heart_rate < hr_low:
            deviation = (hr_low - heart_rate) / hr_low * 100
            result["is_anomaly"] = True
            result["severity"] = "medium"
            if using_ai_baseline:
                result["message"] = f"心率{heart_rate}bpm，低于个人基线下限({hr_low:.0f}bpm) {deviation:.0f}%"
            else:
                result["message"] = f"心率偏低 ({heart_rate}bpm)，若非睡眠时段请关注"
            result["deviation_percent"] = round(deviation, 1)
        
        return result
    
    def analyze_blood_pressure(self, systolic: int, diastolic: int, user_id: int = None) -> Dict:
        """Analyze blood pressure for anomalies"""
        # Get user-specific thresholds
        bp_sys_high = BP_SYSTOLIC_HIGH
        bp_sys_low = BP_SYSTOLIC_LOW
        bp_dia_high = BP_DIASTOLIC_HIGH
        
        if user_id:
            settings = self._get_user_settings(user_id)
            if settings:
                bp_sys_high = settings.systolic_bp_threshold_high
                bp_sys_low = settings.systolic_bp_threshold_low
        
        result = {
            "is_anomaly": False,
            "severity": "normal",
            "message": "血压正常"
        }
        
        if systolic > bp_sys_high or diastolic > bp_dia_high:
            result["is_anomaly"] = True
            result["severity"] = "high" if systolic > 160 else "warning"
            result["message"] = f"血压偏高 ({systolic}/{diastolic}mmHg)，建议休息并持续监测"
        elif systolic < bp_sys_low:
            result["is_anomaly"] = True
            result["severity"] = "warning"
            result["message"] = f"血压偏低 ({systolic}/{diastolic}mmHg)，注意补充水分"
        
        return result
    
    def analyze_location(self, lat: float, lng: float, user_id: int = None, historical_records: List[HealthRecord] = None) -> Dict:
        """Analyze location for anomalies"""
        # Get user-specific safe zones
        safe_zones = self._get_safe_zones(user_id) if user_id else SAFE_ZONES
        
        result = {
            "is_anomaly": False,
            "severity": "normal",
            "location_name": get_location_name(lat, lng, safe_zones),
            "message": "位置正常"
        }
        
        if not is_in_safe_zone(lat, lng, safe_zones):
            result["is_anomaly"] = True
            result["severity"] = "high"
            result["location_name"] = "未知区域"
            result["message"] = "检测到偏离日常活动区域，请确认老人状况"
        
        return result
    
    def analyze_activity_pattern(self, current_hour: int, heart_rate: int, steps: int) -> Dict:
        """Analyze if current activity matches expected pattern"""
        result = {
            "is_anomaly": False,
            "severity": "normal",
            "activity": "正常活动",
            "message": "活动模式正常"
        }
        
        # Night time (22:00 - 06:00): should be resting
        if (current_hour >= 22 or current_hour < 6):
            if heart_rate > 85 or steps > 100:
                result["is_anomaly"] = True
                result["severity"] = "warning"
                result["activity"] = "夜间异常活动"
                result["message"] = "夜间检测到异常活动，可能是失眠或其他情况"
        
        # Morning exercise time (07:00 - 09:00): expect moderate activity
        elif 7 <= current_hour <= 9:
            result["activity"] = "晨练时间"
            if heart_rate > 120:
                result["is_anomaly"] = True
                result["severity"] = "warning"
                result["message"] = "晨练期间心率过高，建议适当休息"
        
        # Rest time (12:00 - 14:00): expect low activity
        elif 12 <= current_hour <= 14:
            result["activity"] = "午休时间"
            if heart_rate > 100 and steps > 500:
                result["is_anomaly"] = True
                result["severity"] = "medium"
                result["message"] = "午休时段检测到较高活动量"
        
        return result
    
    def get_baseline_context(self, user_id: int) -> Dict:
        """Get AI baseline context for multi-dimension analysis"""
        profile = self._get_health_profile(user_id)
        if not profile:
            return {
                "has_profile": False,
                "learned_hr_low": HEART_RATE_LOW,
                "learned_hr_high": HEART_RATE_HIGH,
                "learned_hr_mean": 72,
                "resting_hr": 65,
                "daily_steps_mean": 5000,
                "wake_time": "06:30",
                "sleep_time": "21:30",
                "outdoor_preference": "morning",
                "home_stay_ratio": 0.7,
                "confidence_score": 0
            }
        
        return {
            "has_profile": True,
            "learned_hr_low": profile.learned_hr_low,
            "learned_hr_high": profile.learned_hr_high,
            "learned_hr_mean": profile.learned_hr_mean,
            "resting_hr": profile.resting_hr,
            "daily_steps_mean": profile.daily_steps_mean,
            "wake_time": profile.wake_time,
            "sleep_time": profile.sleep_time,
            "outdoor_preference": profile.outdoor_preference,
            "home_stay_ratio": profile.home_stay_ratio,
            "health_summary": profile.health_summary,
            "confidence_score": profile.confidence_score
        }

    def comprehensive_analysis(
        self,
        record: HealthRecord,
        historical_records: List[HealthRecord] = None
    ) -> Dict:
        """Perform comprehensive multi-modal analysis with AI baseline support"""
        
        # Individual analyses with AI baseline or user-specific settings
        hr_result = self.analyze_heart_rate(record.heart_rate, record.user_id)
        bp_result = self.analyze_blood_pressure(record.systolic_bp, record.diastolic_bp, record.user_id)
        loc_result = self.analyze_location(record.latitude, record.longitude, record.user_id, historical_records)
        
        current_hour = record.timestamp.hour if record.timestamp else datetime.now(timezone.utc).hour
        activity_result = self.analyze_activity_pattern(current_hour, record.heart_rate, record.steps)
        
        # Get AI baseline context
        baseline_context = self.get_baseline_context(record.user_id)
        
        # Calculate overall risk
        severity_scores = {"normal": 0, "low": 1, "medium": 2, "warning": 3, "high": 4}
        max_severity = max(
            severity_scores.get(hr_result["severity"], 0),
            severity_scores.get(bp_result["severity"], 0),
            severity_scores.get(loc_result["severity"], 0),
            severity_scores.get(activity_result["severity"], 0)
        )
        
        # Count anomalies
        anomaly_count = sum([
            hr_result["is_anomaly"],
            bp_result["is_anomaly"],
            loc_result["is_anomaly"],
            activity_result["is_anomaly"]
        ])
        
        # Determine overall status
        if max_severity >= 4 or anomaly_count >= 2:
            overall_status = "danger"
            overall_risk = "高"
        elif max_severity >= 2:
            overall_status = "warning"
            overall_risk = "中"
        else:
            overall_status = "safe"
            overall_risk = "低"
        
        # Build comprehensive message
        messages = []
        if hr_result["is_anomaly"]:
            messages.append(hr_result["message"])
        if bp_result["is_anomaly"]:
            messages.append(bp_result["message"])
        if loc_result["is_anomaly"]:
            messages.append(loc_result["message"])
        if activity_result["is_anomaly"]:
            messages.append(activity_result["message"])
        
        if not messages:
            # 双重检查：如果状态不是 safe，必须给出解释，防止"高风险+状态良好"的矛盾
            if overall_status != "safe":
                if overall_status == "danger":
                    messages.append("检测到多项生理指标异常，系统判定为高风险状态，请立即确认老人安全！")
                else:
                    messages.append("检测到部分指标轻微偏离正常范围，建议保持关注。")
            else:
                # 只有真的是 safe 才显示正常信息
                if activity_result["activity"] == "晨练时间":
                    messages.append("父亲正在公园进行日常晨练，各项指标正常。")
                elif activity_result["activity"] == "午休时间":
                     messages.append("当前为午休时段，老人心率平稳，处于休息状态。")
                else:
                    messages.append("目前各项生命体征平稳，老人状态安详。")
        
        return {
            "overall_status": overall_status,
            "overall_risk": overall_risk,
            "anomaly_count": anomaly_count,
            "heart_rate_analysis": hr_result,
            "blood_pressure_analysis": bp_result,
            "location_analysis": loc_result,
            "activity_analysis": activity_result,
            "summary_message": " ".join(messages),
            "baseline_context": baseline_context,
            "using_ai_baseline": hr_result.get("using_ai_baseline", False)
        }
    
    def build_health_response(
        self,
        record: HealthRecord,
        analysis: Dict,
        battery: int = 85
    ) -> HealthDataResponse:
        """Build frontend-compatible health data response"""
        
        location_name = analysis["location_analysis"]["location_name"]
        activity = analysis["activity_analysis"]["activity"]
        
        # Calculate time diff for lastUpdate
        now = datetime.now(timezone.utc)
        # Make record.timestamp timezone-aware if it isn't
        record_time = record.timestamp
        if record_time.tzinfo is None:
            record_time = record_time.replace(tzinfo=timezone.utc)
        time_diff = now - record_time
        if time_diff.seconds < 60:
            last_update = "刚刚"
        elif time_diff.seconds < 3600:
            last_update = f"{time_diff.seconds // 60}分钟前"
        else:
            last_update = f"{time_diff.seconds // 3600}小时前"
        
        return HealthDataResponse(
            status=analysis["overall_status"],
            heartRate=record.heart_rate,
            bloodPressure=f"{record.systolic_bp}/{record.diastolic_bp}",
            stepCount=record.steps,
            location=location_name,
            activity=activity,
            riskLevel=analysis["overall_risk"],
            battery=battery,
            lastUpdate=last_update,
            message=analysis["summary_message"],
            latitude=record.latitude,
            longitude=record.longitude
        )


# Singleton instance
anomaly_detector = AnomalyDetector()
