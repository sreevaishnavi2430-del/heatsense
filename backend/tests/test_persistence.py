"""Test persistent storage layer, models, repository, and lifecycle."""
import asyncio
import hashlib
from contextlib import asynccontextmanager
import pytest
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.db.models import (
    Base,
    Subscriber,
)
from app.db import repository


@asynccontextmanager
async def create_test_session():
    """Create an isolated in-memory SQLite database session for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


def test_seed_database():
    async def run():
        async with create_test_session() as session:
            counts = await repository.seed_database(session, reset=True)
            assert counts["wards"] == 40
            assert counts["alerts"] == 12
            assert counts["templates"] == 9
            assert counts["rules"] == 3

            wards = await repository.get_all_wards(session)
            assert len(wards) == 40
            assert wards[0]["id"]
            assert wards[0]["name"]
            assert "polygon" in wards[0]
            assert "vulnerability" in wards[0]

            alerts = await repository.get_all_alerts(session)
            assert len(alerts) == 12
    asyncio.run(run())


def test_subscriber_persistence_and_privacy():
    async def run():
        async with create_test_session() as session:
            phone = "9876543210"
            phone_hash = hashlib.sha256(phone.encode()).hexdigest()
            cipher = Fernet(settings.FERNET_KEY.encode())
            phone_encrypted = cipher.encrypt(phone.encode()).decode()

            sub = await repository.create_or_update_subscriber(
                session,
                sub_id="sub-test-1",
                name="Lakshmi Rao",
                phone_hash=phone_hash,
                phone_encrypted=phone_encrypted,
                ward_id="charminar",
                language="te",
                role="resident",
                channel="SMS",
            )

            assert sub["id"] == "sub-test-1"
            assert sub["name"] == "Lakshmi Rao"
            assert sub["active"] is True
            assert "phone" not in sub
            assert "phoneEncrypted" not in sub

            # Verify directly from database table
            stmt = select(Subscriber).where(Subscriber.id == "sub-test-1")
            db_record = (await session.execute(stmt)).scalar_one()
            assert db_record.phone_hash == phone_hash
            decrypted = cipher.decrypt(db_record.phone_encrypted.encode()).decode()
            assert decrypted == phone

            # Test deactivation (unsubscribe)
            deactivated = await repository.deactivate_subscriber_by_hash(session, phone_hash)
            assert deactivated is True

            stmt = select(Subscriber).where(Subscriber.id == "sub-test-1")
            updated = (await session.execute(stmt)).scalar_one()
            assert updated.active is False
    asyncio.run(run())


def test_plan_persistence_and_retrieval():
    async def run():
        async with create_test_session() as session:
            plan_id = "plan-abc-123"
            short_code = "short1"
            items = [{"type": "tree_planting", "costLakhINR": 15, "wardId": "charminar"}]
            totals = {"cost": 15, "peopleProtected": 12000}

            saved = await repository.save_plan(session, plan_id, short_code, "Charminar Heat Plan", items, totals)
            assert saved["id"] == plan_id
            assert saved["shortCode"] == short_code

            fetched_by_code = await repository.get_plan_by_short_code(session, short_code)
            assert fetched_by_code is not None
            assert fetched_by_code["name"] == "Charminar Heat Plan"
            assert len(fetched_by_code["items"]) == 1

            fetched_by_id = await repository.get_plan_by_id(session, plan_id)
            assert fetched_by_id is not None
            assert fetched_by_id["shortCode"] == short_code

            deleted = await repository.delete_plan_by_id(session, plan_id)
            assert deleted is True

            assert await repository.get_plan_by_id(session, plan_id) is None
    asyncio.run(run())


def test_devices_and_sensor_readings():
    async def run():
        async with create_test_session() as session:
            did = "esp32-001"
            key = "secret-device-token"
            key_hash = hashlib.sha256(key.encode()).hexdigest()

            device = await repository.register_device(
                session,
                device_id=did,
                name="Charminar Station 1",
                ward_id="charminar",
                key_hash=key_hash,
            )
            assert device["id"] == did

            reading = await repository.add_sensor_reading(
                session,
                {
                    "deviceId": did,
                    "wardId": "charminar",
                    "tempC": 42.5,
                    "humidity": 32.0,
                    "batteryV": 3.9,
                    "recordedAt": "2026-05-15T14:30:00+00:00",
                }
            )
            assert reading["id"] is not None
            assert reading["tempC"] == 42.5

            all_readings = await repository.get_all_readings(session)
            assert len(all_readings) >= 1
            assert all_readings[0]["tempC"] == 42.5
    asyncio.run(run())


def test_city_settings_persistence():
    async def run():
        async with create_test_session() as session:
            custom_weights = {"wTemp": 0.40, "wTree": 0.25, "wBuilt": 0.15, "wVuln": 0.20}
            updated = await repository.update_city_settings(session, {"weights": custom_weights})
            assert updated["weights"] == custom_weights

            fetched = await repository.get_city_settings(session)
            assert fetched["weights"] == custom_weights
    asyncio.run(run())
