from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime, timezone
from pydantic import BaseModel, field_validator, model_validator


def utc_now() -> datetime:
    """Get current UTC time with timezone info"""
    return datetime.now(timezone.utc)

# ============ Database Models ============
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    phone: str = Field(unique=True, index=True)
    password_hash: str = ""
    role: str = "elder"  # elder, guardian
    elder_id: Optional[int] = Field(default=None)  # guardian关联的老人ID (保留用于向后兼容)
    created_at: datetime = Field(default_factory=utc_now)


class GuardianRelation(SQLModel, table=True):
    """监护关系表 - 支持多对多关系"""
    id: Optional[int] = Field(default=None, primary_key=True)
    guardian_id: int = Field(foreign_key="user.id", index=True)  # 监护人ID
    elder_id: int = Field(foreign_key="user.id", index=True)  # 老人ID
    relation_type: str = "family"  # family, professional, volunteer
    is_primary: bool = True  # 是否为主要监护人
    created_at: datetime = Field(default_factory=utc_now)


class SafeZone(SQLModel, table=True):
    """安全区域表"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)  # 老人ID
    zone_name: str  # 区域名称
    latitude: float  # 中心纬度
    longitude: float  # 中心经度
    radius: float = 100.0  # 半径(米)
    is_active: bool = True  # 是否启用
    created_at: datetime = Field(default_factory=utc_now)


class Device(SQLModel, table=True):
    """设备表"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)  # 老人ID
    device_id: str = Field(unique=True, index=True)  # 设备唯一标识
    device_type: str = "wristband"  # wristband, phone, etc.
    battery_level: int = 100  # 电量百分比
    last_sync: datetime = Field(default_factory=utc_now)  # 最后同步时间
    is_active: bool = True  # 是否激活
    created_at: datetime = Field(default_factory=utc_now)


class UserSettings(SQLModel, table=True):
    """用户设置表"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, index=True)  # 用户ID
    heart_rate_threshold_high: int = 100  # 心率上限
    heart_rate_threshold_low: int = 50  # 心率下限
    systolic_bp_threshold_high: int = 140  # 收缩压上限
    systolic_bp_threshold_low: int = 90  # 收缩压下限
    notification_enabled: bool = True  # 是否启用通知
    emergency_contact: Optional[str] = None  # 紧急联系人电话
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class HealthRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    device_id: Optional[int] = Field(default=None, index=True)  # 关联的设备ID
    heart_rate: int
    systolic_bp: int
    diastolic_bp: int
    steps: int
    latitude: float
    longitude: float
    timestamp: datetime = Field(default_factory=utc_now, index=True)  # 添加索引

class Alert(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    health_record_id: Optional[int] = Field(default=None, index=True)  # 关联的健康记录ID
    alert_type: str
    severity: str
    description: str
    is_read: bool = False
    status: str = "pending"  # pending, acknowledged, resolved
    handled_by: Optional[int] = Field(default=None)  # 处理人ID
    handled_at: Optional[datetime] = None  # 处理时间
    timestamp: datetime = Field(default_factory=utc_now, index=True)  # 添加索引


class EmergencyContact(SQLModel, table=True):
    """紧急联系人表"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)  # 所属用户ID
    name: str  # 联系人姓名
    phone: str  # 联系电话
    relation: str = "家人"  # 关系：家人、朋友、邻居、医生、其他
    is_primary: bool = False  # 是否为首要联系人
    created_at: datetime = Field(default_factory=utc_now)


class HealthProfile(SQLModel, table=True):
    """AI学习的个性化健康画像"""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(unique=True, index=True)  # 老人ID
    
    # AI学习的心率基线
    learned_hr_low: float = 60.0  # 学习到的心率下限
    learned_hr_high: float = 100.0  # 学习到的心率上限
    learned_hr_mean: float = 72.0  # 平均心率
    learned_hr_std: float = 10.0  # 心率标准差
    resting_hr: float = 65.0  # 静息心率
    exercise_hr_max: float = 110.0  # 运动时最大心率
    
    # AI学习的血压基线
    learned_systolic_mean: float = 120.0  # 平均收缩压
    learned_systolic_std: float = 10.0  # 收缩压标准差
    learned_diastolic_mean: float = 80.0  # 平均舒张压
    
    # AI学习的活动模式 (JSON字符串存储)
    wake_time: str = "06:30"  # 平均起床时间
    sleep_time: str = "21:30"  # 平均入睡时间
    active_hours: str = "[7,8,9,15,16,17]"  # 活跃时段 JSON数组
    daily_steps_mean: int = 5000  # 日均步数
    daily_steps_std: int = 1500  # 步数标准差
    
    # AI学习的位置习惯
    home_stay_ratio: float = 0.7  # 在家时间比例
    frequent_locations: str = "[]"  # 常去位置 JSON数组
    outdoor_preference: str = "morning"  # 外出偏好: morning/afternoon/evening
    
    # AI生成的健康摘要
    health_summary: str = ""  # 一句话健康特点总结
    risk_factors: str = "[]"  # 风险因素 JSON数组
    personalized_advice: str = "[]"  # 个性化建议 JSON数组
    
    # AI分析置信度
    confidence_score: float = 0.0  # 画像置信度 (0-1)
    data_quality: str = "insufficient"  # 数据质量: insufficient/fair/good/excellent
    
    # 元数据
    learning_days: int = 0  # 学习使用的天数
    total_records_analyzed: int = 0  # 分析的总记录数
    last_learning_at: Optional[datetime] = None  # 上次学习时间
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


# ============ Pydantic Schemas (API Request/Response) ============
class UserRegister(BaseModel):
    phone: str
    password: str
    username: str
    role: str = "guardian"
    elder_id: Optional[int] = None


class UserLogin(BaseModel):
    phone: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    phone: str
    role: str
    elder_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class HealthRecordCreate(BaseModel):
    user_id: int
    heart_rate: int
    systolic_bp: int
    diastolic_bp: int
    steps: int
    latitude: float
    longitude: float
    
    @field_validator('heart_rate')
    @classmethod
    def validate_heart_rate(cls, v: int) -> int:
        if not 20 <= v <= 250:
            raise ValueError('Heart rate must be between 20 and 250 bpm')
        return v
    
    @field_validator('systolic_bp')
    @classmethod
    def validate_systolic_bp(cls, v: int) -> int:
        if not 60 <= v <= 250:
            raise ValueError('Systolic blood pressure must be between 60 and 250 mmHg')
        return v
    
    @field_validator('diastolic_bp')
    @classmethod
    def validate_diastolic_bp(cls, v: int) -> int:
        if not 40 <= v <= 150:
            raise ValueError('Diastolic blood pressure must be between 40 and 150 mmHg')
        return v
    
    @field_validator('steps')
    @classmethod
    def validate_steps(cls, v: int) -> int:
        if v < 0:
            raise ValueError('Steps cannot be negative')
        if v > 100000:
            raise ValueError('Steps seem unrealistically high (>100000)')
        return v
    
    @field_validator('latitude')
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @field_validator('longitude')
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v
    
    @model_validator(mode='after')
    def validate_blood_pressure_ratio(self):
        if self.diastolic_bp >= self.systolic_bp:
            raise ValueError('Diastolic BP must be less than systolic BP')
        return self


class HealthDataResponse(BaseModel):
    status: str
    heartRate: int
    bloodPressure: str
    stepCount: int
    location: str
    activity: str
    riskLevel: str
    battery: int
    lastUpdate: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    description: str
    is_read: bool
    timestamp: datetime

    class Config:
        from_attributes = True
