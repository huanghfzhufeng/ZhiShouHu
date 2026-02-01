"""
Database initialization and seed data generation
"""
from sqlmodel import Session, select
from datetime import datetime, timedelta, timezone
import random

from app.models import User, HealthRecord, Alert
from app.api.auth import get_password_hash
from app.logger import get_logger

logger = get_logger(__name__)


# Default locations for simulation
LOCATIONS = [
    {"name": "家", "lat": 30.2741, "lng": 120.1551},
    {"name": "幸福社区公园", "lat": 30.2761, "lng": 120.1581},
    {"name": "幸福社区菜市场", "lat": 30.2721, "lng": 120.1531},
    {"name": "社区医院", "lat": 30.2701, "lng": 120.1601},
]


def create_default_users(session: Session) -> tuple:
    """Create default elder and guardian users"""
    
    # Check if users already exist
    existing_elder = session.exec(
        select(User).where(User.phone == "13800000001")
    ).first()
    
    if existing_elder:
        existing_guardian = session.exec(
            select(User).where(User.phone == "13800000002")
        ).first()
        return existing_elder, existing_guardian
    
    # Create elder user
    elder = User(
        username="李建国",
        phone="13800000001",
        password_hash=get_password_hash("123456"),
        role="elder",
        elder_id=None
    )
    session.add(elder)
    session.commit()
    session.refresh(elder)
    
    # Create guardian user (linked to elder)
    guardian = User(
        username="李华",
        phone="13800000002",
        password_hash=get_password_hash("123456"),
        role="guardian",
        elder_id=elder.id
    )
    session.add(guardian)
    session.commit()
    session.refresh(guardian)
    
    logger.info(f"Created default users: Elder(id={elder.id}), Guardian(id={guardian.id})")
    return elder, guardian


def generate_health_records(session: Session, elder_id: int, days: int = 7):
    """Generate simulated health records for the past N days"""
    
    # Check if records already exist
    existing_count = session.exec(
        select(HealthRecord).where(HealthRecord.user_id == elder_id)
    ).first()
    
    if existing_count:
        logger.info(f"Health records already exist for elder {elder_id}")
        return
    
    records = []
    now = datetime.now(timezone.utc)
    
    for day in range(days):
        date = now - timedelta(days=day)
        
        # Generate 24 records per day (one per hour)
        for hour in range(24):
            timestamp = date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            
            # Realistic Circadian Rhythms
            if 0 <= hour < 6: # Deep sleep
                heart_rate = random.randint(58, 68)
                systolic = random.randint(105, 115)
                diastolic = random.randint(65, 75)
                steps = 0
                location = LOCATIONS[0] # Home
            elif 6 <= hour < 9: # Waking up and Morning exercise
                heart_rate = random.randint(75, 100)
                systolic = random.randint(120, 138)
                diastolic = random.randint(80, 88)
                steps = random.randint(1000, 3000)
                location = random.choices([LOCATIONS[0], LOCATIONS[1]], weights=[0.3, 0.7])[0]
            elif 9 <= hour < 18: # Day time activity
                heart_rate = random.randint(70, 85)
                systolic = random.randint(118, 130)
                diastolic = random.randint(75, 85)
                steps = random.randint(200, 800)
                location = random.choice(LOCATIONS)
            else: # Evening / Relaxing
                heart_rate = random.randint(65, 75)
                systolic = random.randint(115, 125)
                diastolic = random.randint(75, 82)
                steps = random.randint(50, 200)
                location = LOCATIONS[0] # Home

            # Add some anomalies for realism (e.g., occasional spike)
            if random.random() < 0.02: # 2% chance of random small anomaly
                heart_rate += 15
            
            record = HealthRecord(
                user_id=elder_id,
                heart_rate=heart_rate,
                systolic_bp=systolic,
                diastolic_bp=diastolic,
                steps=steps,
                latitude=location["lat"] + random.uniform(-0.0005, 0.0005),
                longitude=location["lng"] + random.uniform(-0.0005, 0.0005),
                timestamp=timestamp
            )
            records.append(record)
    
    # Sort by timestamp
    records.sort(key=lambda x: x.timestamp)
    
    for record in records:
        session.add(record)
    session.commit()
    
    logger.info(f"Generated {len(records)} realistic health records for elder {elder_id}")


def generate_alerts(session: Session, elder_id: int):
    """Generate some sample alerts"""
    
    # Check if alerts already exist
    existing = session.exec(
        select(Alert).where(Alert.user_id == elder_id)
    ).first()
    
    if existing:
        logger.info(f"Alerts already exist for elder {elder_id}")
        return
    
    now = datetime.now(timezone.utc)
    
    alerts = [
        Alert(
            user_id=elder_id,
            alert_type="daily_report",
            severity="info",
            description="父亲已结束晨练返回家中，今日运动量达标。",
            is_read=True,
            timestamp=now - timedelta(hours=2)
        ),
        Alert(
            user_id=elder_id,
            alert_type="device",
            severity="info",
            description="智能手环昨夜已充满电，当前电量 100%。",
            is_read=True,
            timestamp=now - timedelta(hours=5)
        ),
        Alert(
            user_id=elder_id,
            alert_type="health",
            severity="warning",
            description="昨日晚间检测到血压轻微升高 (135/90)，请留意饮食。",
            is_read=True,
            timestamp=now - timedelta(days=1, hours=4)
        ),
        Alert(
            user_id=elder_id,
            alert_type="location",
            severity="info",
            description="检测到到达\"幸福社区菜市场\"。",
            is_read=True,
            timestamp=now - timedelta(days=1, hours=9)
        ),
        Alert(
            user_id=elder_id,
            alert_type="health",
            severity="high",
            description="周五14:00检测到心率短时升高(110bpm)，疑似爬楼梯或轻度运动。",
            is_read=True,
            timestamp=now - timedelta(days=3, hours=10)
        ),
    ]
    
    for alert in alerts:
        session.add(alert)
    session.commit()
    
    logger.info(f"Generated {len(alerts)} sample alerts for elder {elder_id}")


def init_seed_data(session: Session):
    """Initialize all seed data"""
    logger.info("Initializing seed data...")
    
    # Create users
    elder, guardian = create_default_users(session)
    
    # Generate health records
    generate_health_records(session, elder.id, days=7)
    
    # Generate alerts
    generate_alerts(session, elder.id)
    
    # Run database migration to populate new tables
    logger.info("Running database migration...")
    try:
        from app.migrate_db import (
            migrate_guardian_relations,
            create_default_safe_zones,
            create_default_devices,
            create_default_user_settings
        )
        
        migrate_guardian_relations(session)
        create_default_safe_zones(session)
        create_default_devices(session)
        create_default_user_settings(session)
        logger.info("Migration completed!")
    except Exception as e:
        logger.warning(f"Migration warning: {e}")
    
    logger.info("Seed data initialization complete!")
    logger.info("Elder login: 13800000001 / 123456")
    logger.info("Guardian login: 13800000002 / 123456")
