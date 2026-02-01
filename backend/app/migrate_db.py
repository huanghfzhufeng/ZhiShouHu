"""
Database migration script to migrate from old schema to new schema
This script handles:
1. Creating GuardianRelation records from User.elder_id
2. Creating default SafeZone records for existing elders
3. Creating default Device records for existing elders
4. Creating default UserSettings for existing users
"""
from sqlmodel import Session, select
from datetime import datetime

from app.db import engine
from app.models import (
    User, GuardianRelation, SafeZone, Device, UserSettings,
    HealthRecord, Alert
)


# Default safe zones for migration
DEFAULT_SAFE_ZONES = [
    {"name": "家", "lat": 30.2741, "lng": 120.1551, "radius": 50.0},
    {"name": "幸福社区公园", "lat": 30.2761, "lng": 120.1581, "radius": 100.0},
    {"name": "幸福社区菜市场", "lat": 30.2721, "lng": 120.1531, "radius": 80.0},
    {"name": "社区医院", "lat": 30.2701, "lng": 120.1601, "radius": 100.0},
]


def migrate_guardian_relations(session: Session):
    """Migrate User.elder_id to GuardianRelation table"""
    print("📋 Migrating guardian relations...")
    
    # Find all guardians with elder_id
    guardians = session.exec(
        select(User).where(User.role == "guardian", User.elder_id.isnot(None))
    ).all()
    
    migrated_count = 0
    for guardian in guardians:
        # Check if relation already exists
        existing = session.exec(
            select(GuardianRelation).where(
                GuardianRelation.guardian_id == guardian.id,
                GuardianRelation.elder_id == guardian.elder_id
            )
        ).first()
        
        if not existing:
            relation = GuardianRelation(
                guardian_id=guardian.id,
                elder_id=guardian.elder_id,
                relation_type="family",
                is_primary=True,
                created_at=guardian.created_at or datetime.utcnow()
            )
            session.add(relation)
            migrated_count += 1
    
    session.commit()
    print(f"✓ Migrated {migrated_count} guardian relations")


def create_default_safe_zones(session: Session):
    """Create default safe zones for all elders"""
    print("🗺️  Creating default safe zones...")
    
    # Find all elders
    elders = session.exec(select(User).where(User.role == "elder")).all()
    
    created_count = 0
    for elder in elders:
        # Check if elder already has safe zones
        existing_zones = session.exec(
            select(SafeZone).where(SafeZone.user_id == elder.id)
        ).first()
        
        if not existing_zones:
            # Create default safe zones for this elder
            for zone_data in DEFAULT_SAFE_ZONES:
                zone = SafeZone(
                    user_id=elder.id,
                    zone_name=zone_data["name"],
                    latitude=zone_data["lat"],
                    longitude=zone_data["lng"],
                    radius=zone_data["radius"],
                    is_active=True
                )
                session.add(zone)
                created_count += 1
    
    session.commit()
    print(f"✓ Created {created_count} default safe zones")


def create_default_devices(session: Session):
    """Create default device records for all elders"""
    print("📱 Creating default device records...")
    
    elders = session.exec(select(User).where(User.role == "elder")).all()
    
    created_count = 0
    for elder in elders:
        # Check if elder already has a device
        existing_device = session.exec(
            select(Device).where(Device.user_id == elder.id)
        ).first()
        
        if not existing_device:
            device = Device(
                user_id=elder.id,
                device_id=f"WRISTBAND_{elder.id:06d}",
                device_type="wristband",
                battery_level=85,
                last_sync=datetime.utcnow(),
                is_active=True
            )
            session.add(device)
            created_count += 1
    
    session.commit()
    print(f"✓ Created {created_count} default device records")


def create_default_user_settings(session: Session):
    """Create default user settings for all users"""
    print("⚙️  Creating default user settings...")
    
    users = session.exec(select(User)).all()
    
    created_count = 0
    for user in users:
        # Check if user already has settings
        existing_settings = session.exec(
            select(UserSettings).where(UserSettings.user_id == user.id)
        ).first()
        
        if not existing_settings:
            settings = UserSettings(
                user_id=user.id,
                heart_rate_threshold_high=100,
                heart_rate_threshold_low=50,
                systolic_bp_threshold_high=140,
                systolic_bp_threshold_low=90,
                notification_enabled=True,
                emergency_contact=None
            )
            session.add(settings)
            created_count += 1
    
    session.commit()
    print(f"✓ Created {created_count} default user settings")


def run_migration():
    """Run all migration tasks"""
    print("\n" + "="*60)
    print("🚀 Starting database migration...")
    print("="*60 + "\n")
    
    with Session(engine) as session:
        try:
            # Run all migration functions
            migrate_guardian_relations(session)
            create_default_safe_zones(session)
            create_default_devices(session)
            create_default_user_settings(session)
            
            print("\n" + "="*60)
            print("✅ Migration completed successfully!")
            print("="*60 + "\n")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            session.rollback()
            raise


if __name__ == "__main__":
    run_migration()
