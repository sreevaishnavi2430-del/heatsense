"""Database repository providing async operations and data seeding."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional
from datetime import datetime, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Ward,
    Alert,
    Subscriber,
    Plan,
    Device,
    SensorReading,
    AlertTemplate,
    AlertRule,
    CitySetting,
    IngestionRun,
)

logger = logging.getLogger(__name__)
SEED_DIR = Path(__file__).parent.parent / "seed"


async def seed_database(session: AsyncSession, reset: bool = False) -> dict[str, int]:
    """Seed wards, alerts, templates, rules, and settings from JSON fixtures."""
    counts = {"wards": 0, "alerts": 0, "templates": 0, "rules": 0}

    # 1. Wards
    stmt = select(Ward)
    existing_wards = (await session.execute(stmt)).scalars().all()
    if not existing_wards or reset:
        if reset:
            await session.execute(delete(Ward))
        mock_wards_file = SEED_DIR / "mock_wards.json"
        if mock_wards_file.is_file():
            raw_wards = json.loads(mock_wards_file.read_text(encoding="utf-8"))
            for w in raw_wards:
                session.add(Ward.from_dict(w))
            counts["wards"] = len(raw_wards)

    # 2. Alerts
    stmt = select(Alert)
    existing_alerts = (await session.execute(stmt)).scalars().all()
    if not existing_alerts or reset:
        if reset:
            await session.execute(delete(Alert))
        mock_alerts_file = SEED_DIR / "mock_alerts.json"
        if mock_alerts_file.is_file():
            raw_alerts = json.loads(mock_alerts_file.read_text(encoding="utf-8"))
            for a in raw_alerts:
                session.add(Alert.from_dict(a))
            counts["alerts"] = len(raw_alerts)

    # 3. Default templates
    stmt = select(AlertTemplate)
    existing_templates = (await session.execute(stmt)).scalars().all()
    if not existing_templates or reset:
        if reset:
            await session.execute(delete(AlertTemplate))
        default_templates = [
            {"id": f"{level.lower()}-{lang}", "level": level, "language": lang, "title": title, "body": body, "tips": ["Drink water often", "Avoid outdoor activity from 12 to 4 PM", "Wear light cotton clothes", "Check on older neighbours; call 108 for heat stroke"]}
            for level, title, bodies in [
                ("Yellow", "Heat safety advisory", ["Heat advisory for {ward} ({temp}°C). Drink water, wear light cotton clothes and check on older neighbours. Avoid midday sun.", "{ward} లో వేడి ఎక్కువగా ఉంది ({temp}°C). నీరు త్రాగండి, తేలికపాటి పత్తి దుస్తులు ధరించండి. మధ్యాహ్నం ఎండను నివారించండి.", "{ward} में गर्मी अधिक है ({temp}°C)। पानी पिएं, हल्के सूती कपड़े पहनें और दोपहर की धूप से बचें।"]),
                ("Orange", "Severe heat warning", ["ORANGE ALERT for {ward}: avoid going out 12–4 PM. Drink water and check on older neighbours. Call 108 for heat stroke.", "{ward} కు ఆరెంజ్ హెచ్చరిక: మధ్యాహ్నం 12–4 బయటకు వెళ్లవద్దు. నీరు త్రాగండి. హీట్ స్ట్రోక్‌కు 108కు కాల్ చేయండి.", "{ward} के लिए ऑरेंज चेतावनी: दोपहर 12–4 बजे बाहर न जाएं। पानी पिएं। लू लगने पर 108 पर कॉल करें."]),
                ("Red", "Extreme heat emergency", ["RED ALERT for {ward}: stay in shade, drink water and avoid outdoor work during peak heat. Call 108 for confusion, fainting or hot dry skin.", "{ward} కు రెడ్ హెచ్చరిక: నీడలో ఉండండి, నీరు త్రాగండి, తీవ్రమైన వేడిలో బయట పని చేయవద్దు. అత్యవసరానికి 108కు కాల్ చేయండి.", "{ward} के लिए रेड चेतावनी: छाया में रहें, पानी पिएं और तेज गर्मी में बाहर काम न करें। आपात स्थिति में 108 पर कॉल करें."])
            ]
            for lang, body in zip(("en", "te", "hi"), bodies)
        ]
        for t in default_templates:
            session.add(AlertTemplate(
                id=t["id"],
                level=t["level"],
                language=t["language"],
                title=t["title"],
                body=t["body"],
                tips=t["tips"],
            ))
        counts["templates"] = len(default_templates)

    # 4. Default rules
    stmt = select(AlertRule)
    existing_rules = (await session.execute(stmt)).scalars().all()
    if not existing_rules or reset:
        if reset:
            await session.execute(delete(AlertRule))
        default_rules = [
            {"id": "rule-forecast-43", "name": "Consecutive extreme forecast", "condition": {"metric": "forecastSurfaceTempC", "operator": ">", "value": 43, "consecutiveDays": 2}, "level": "Orange", "wards_scope": "allSevere", "enabled": True, "auto_send": False},
            {"id": "rule-red-45", "name": "Extreme heat forecast", "condition": {"metric": "forecastSurfaceTempC", "operator": ">=", "value": 45, "consecutiveDays": 1}, "level": "Red", "wards_scope": "allSevere", "enabled": True, "auto_send": False},
            {"id": "rule-grid-stress", "name": "High power stress", "condition": {"metric": "stressIndex", "operator": ">", "value": 85, "consecutiveHours": 3}, "level": "Yellow", "wards_scope": "all", "enabled": True, "auto_send": False},
        ]
        for r in default_rules:
            session.add(AlertRule(
                id=r["id"],
                name=r["name"],
                condition=r["condition"],
                level=r["level"],
                wards_scope=r["wards_scope"],
                enabled=r["enabled"],
                auto_send=r["auto_send"],
            ))
        counts["rules"] = len(default_rules)

    # 5. Default settings
    stmt = select(CitySetting).where(CitySetting.key == "main")
    setting = (await session.execute(stmt)).scalar_one_or_none()
    if not setting or reset:
        if reset and setting:
            await session.delete(setting)
        default_settings = {
            "weights": {"wTemp": 0.35, "wTree": 0.20, "wBuilt": 0.15, "wVuln": 0.30},
            "temperatureUnit": "C",
            "refreshIntervalSeconds": 60,
            "benchmarks": {"peoplePerWaterPoint": 2000, "peoplePerShadeShelter": 3000},
        }
        session.add(CitySetting(key="main", value=default_settings))

    await session.commit()
    logger.info("Database seed completed: %s", counts)
    return counts


async def get_all_wards(session: AsyncSession) -> list[dict[str, Any]]:
    stmt = select(Ward).order_by(Ward.name)
    result = await session.execute(stmt)
    return [w.to_dict() for w in result.scalars().all()]


async def get_ward_by_id(session: AsyncSession, ward_id: str) -> Optional[dict[str, Any]]:
    stmt = select(Ward).where((Ward.id == ward_id) | (Ward.name.ilike(ward_id)))
    result = await session.execute(stmt)
    ward = result.scalar_one_or_none()
    return ward.to_dict() if ward else None


async def get_all_alerts(
    session: AsyncSession,
    status: Optional[str] = None,
    level: Optional[str] = None,
) -> list[dict[str, Any]]:
    stmt = select(Alert).order_by(Alert.created_at.desc())
    if status:
        stmt = stmt.where(Alert.status == status)
    if level:
        stmt = stmt.where(Alert.level == level)
    result = await session.execute(stmt)
    return [a.to_dict() for a in result.scalars().all()]


async def get_alert_by_id(session: AsyncSession, alert_id: str) -> Optional[dict[str, Any]]:
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()
    return alert.to_dict() if alert else None


async def create_alert_record(session: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    alert = Alert.from_dict(payload)
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert.to_dict()


async def update_alert_status(
    session: AsyncSession,
    alert_id: str,
    status: str,
    delivered_percent: Optional[float] = None,
    recipients_count: Optional[int] = None,
) -> Optional[dict[str, Any]]:
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()
    if not alert:
        return None
    alert.status = status
    if delivered_percent is not None:
        alert.delivered_percent = delivered_percent
    if recipients_count is not None:
        alert.recipients_count = recipients_count
    await session.commit()
    await session.refresh(alert)
    return alert.to_dict()


async def get_subscribers_count(session: AsyncSession) -> int:
    stmt = select(Subscriber).where(Subscriber.active.is_(True))
    result = await session.execute(stmt)
    return len(result.scalars().all())


async def create_or_update_subscriber(
    session: AsyncSession,
    sub_id: str,
    name: str,
    phone_hash: str,
    phone_encrypted: str,
    ward_id: str,
    language: str = "en",
    role: str = "resident",
    channel: str = "SMS",
) -> dict[str, Any]:
    stmt = select(Subscriber).where(Subscriber.phone_hash == phone_hash)
    existing = (await session.execute(stmt)).scalar_one_or_none()
    if existing:
        existing.name = name
        existing.ward_id = ward_id
        existing.language = language
        existing.role = role
        existing.channel = channel
        existing.active = True
        existing.phone_encrypted = phone_encrypted
        await session.commit()
        await session.refresh(existing)
        return existing.to_dict()
    new_sub = Subscriber(
        id=sub_id,
        name=name,
        phone_hash=phone_hash,
        phone_encrypted=phone_encrypted,
        ward_id=ward_id,
        language=language,
        role=role,
        channel=channel,
        consent=True,
        active=True,
    )
    session.add(new_sub)
    await session.commit()
    await session.refresh(new_sub)
    return new_sub.to_dict()


async def deactivate_subscriber_by_hash(session: AsyncSession, phone_hash: str) -> bool:
    stmt = select(Subscriber).where(Subscriber.phone_hash == phone_hash)
    result = await session.execute(stmt)
    sub = result.scalar_one_or_none()
    if not sub:
        return False
    sub.active = False
    await session.commit()
    return True


async def save_plan(session: AsyncSession, plan_id: str, short_code: str, name: str, items: list[Any], totals: dict[str, Any]) -> dict[str, Any]:
    plan = Plan(
        id=plan_id,
        short_code=short_code,
        name=name,
        items=items,
        totals=totals,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return plan.to_dict()


async def get_plan_by_short_code(session: AsyncSession, short_code: str) -> Optional[dict[str, Any]]:
    stmt = select(Plan).where(Plan.short_code == short_code)
    result = await session.execute(stmt)
    plan = result.scalar_one_or_none()
    return plan.to_dict() if plan else None


async def get_plan_by_id(session: AsyncSession, plan_id: str) -> Optional[dict[str, Any]]:
    stmt = select(Plan).where(Plan.id == plan_id)
    result = await session.execute(stmt)
    plan = result.scalar_one_or_none()
    return plan.to_dict() if plan else None


async def delete_plan_by_id(session: AsyncSession, plan_id: str) -> bool:
    stmt = select(Plan).where(Plan.id == plan_id)
    result = await session.execute(stmt)
    plan = result.scalar_one_or_none()
    if not plan:
        return False
    await session.delete(plan)
    await session.commit()
    return True


async def register_device(session: AsyncSession, device_id: str, name: Optional[str], ward_id: Optional[str], key_hash: str) -> dict[str, Any]:
    device = Device(id=device_id, name=name, ward_id=ward_id, key_hash=key_hash, status="active")
    session.add(device)
    await session.commit()
    await session.refresh(device)
    return device.to_dict()


async def add_sensor_reading(session: AsyncSession, reading_data: dict[str, Any]) -> dict[str, Any]:
    reading = SensorReading(
        device_id=reading_data.get("deviceId"),
        ward_id=reading_data.get("wardId"),
        temp_c=float(reading_data["tempC"]),
        humidity=float(reading_data["humidity"]) if reading_data.get("humidity") is not None else None,
        battery_v=float(reading_data["batteryV"]) if reading_data.get("batteryV") is not None else None,
        recorded_at=datetime.fromisoformat(reading_data["recordedAt"]) if reading_data.get("recordedAt") else datetime.now(timezone.utc),
    )
    session.add(reading)
    await session.commit()
    await session.refresh(reading)
    return reading.to_dict()


async def get_all_readings(session: AsyncSession, limit: int = 100) -> list[dict[str, Any]]:
    stmt = select(SensorReading).order_by(SensorReading.recorded_at.desc()).limit(limit)
    result = await session.execute(stmt)
    return [r.to_dict() for r in result.scalars().all()]


async def get_alert_templates(session: AsyncSession) -> list[dict[str, Any]]:
    stmt = select(AlertTemplate)
    result = await session.execute(stmt)
    return [t.to_dict() for t in result.scalars().all()]


async def save_alert_template(session: AsyncSession, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    tmpl = AlertTemplate(
        id=item_id,
        level=payload.get("level", "Yellow"),
        language=payload.get("language", "en"),
        title=payload.get("title", "Heat alert"),
        body=payload.get("body", ""),
        tips=payload.get("tips", []),
    )
    session.add(tmpl)
    await session.commit()
    await session.refresh(tmpl)
    return tmpl.to_dict()


async def update_alert_template(session: AsyncSession, item_id: str, payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    stmt = select(AlertTemplate).where(AlertTemplate.id == item_id)
    tmpl = (await session.execute(stmt)).scalar_one_or_none()
    if not tmpl:
        return None
    for k, v in payload.items():
        if hasattr(tmpl, k):
            setattr(tmpl, k, v)
    await session.commit()
    await session.refresh(tmpl)
    return tmpl.to_dict()


async def delete_alert_template(session: AsyncSession, item_id: str) -> bool:
    stmt = select(AlertTemplate).where(AlertTemplate.id == item_id)
    tmpl = (await session.execute(stmt)).scalar_one_or_none()
    if not tmpl:
        return False
    await session.delete(tmpl)
    await session.commit()
    return True


async def get_alert_rules(session: AsyncSession) -> list[dict[str, Any]]:
    stmt = select(AlertRule)
    result = await session.execute(stmt)
    return [r.to_dict() for r in result.scalars().all()]


async def save_alert_rule(session: AsyncSession, item_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    rule = AlertRule(
        id=item_id,
        name=payload.get("name", "New rule"),
        condition=payload.get("condition", {}),
        level=payload.get("level", "Orange"),
        wards_scope=payload.get("wardsScope", "allSevere"),
        enabled=payload.get("enabled", True),
        auto_send=payload.get("autoSend", False),
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule.to_dict()


async def update_alert_rule(session: AsyncSession, item_id: str, payload: dict[str, Any]) -> Optional[dict[str, Any]]:
    stmt = select(AlertRule).where(AlertRule.id == item_id)
    rule = (await session.execute(stmt)).scalar_one_or_none()
    if not rule:
        return None
    if "wardsScope" in payload:
        rule.wards_scope = payload["wardsScope"]
    if "autoSend" in payload:
        rule.auto_send = payload["autoSend"]
    for k in ("name", "condition", "level", "enabled"):
        if k in payload:
            setattr(rule, k, payload[k])
    await session.commit()
    await session.refresh(rule)
    return rule.to_dict()


async def delete_alert_rule(session: AsyncSession, item_id: str) -> bool:
    stmt = select(AlertRule).where(AlertRule.id == item_id)
    rule = (await session.execute(stmt)).scalar_one_or_none()
    if not rule:
        return False
    await session.delete(rule)
    await session.commit()
    return True


async def get_city_settings(session: AsyncSession) -> dict[str, Any]:
    stmt = select(CitySetting).where(CitySetting.key == "main")
    res = (await session.execute(stmt)).scalar_one_or_none()
    if res and res.value:
        return res.value
    return {
        "weights": {"wTemp": 0.35, "wTree": 0.20, "wBuilt": 0.15, "wVuln": 0.30},
        "temperatureUnit": "C",
        "refreshIntervalSeconds": 60,
        "benchmarks": {"peoplePerWaterPoint": 2000, "peoplePerShadeShelter": 3000},
    }


async def update_city_settings(session: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    stmt = select(CitySetting).where(CitySetting.key == "main")
    res = (await session.execute(stmt)).scalar_one_or_none()
    current = dict(res.value) if res and res.value else {}
    current.update(payload)
    if not res:
        res = CitySetting(key="main", value=current)
        session.add(res)
    else:
        res.value = current
    await session.commit()
    return current


async def get_recent_pipeline_runs(session: AsyncSession, limit: int = 20) -> list[dict]:
    """Fetch recent ingestion run records ordered by start time."""
    result = await session.execute(
        select(IngestionRun).order_by(IngestionRun.started_at.desc()).limit(limit)
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "pipelineName": r.pipeline_name,
            "status": r.status,
            "recordsProcessed": r.records_processed,
            "startedAt": r.started_at.isoformat() if r.started_at else None,
            "finishedAt": r.finished_at.isoformat() if r.finished_at else None,
            "notes": r.notes,
        }
        for r in runs
    ]


async def delete_subscriber_by_hash(session: AsyncSession, phone_hash: str) -> int:
    """Delete subscriber records matching the phone hash. Returns count deleted."""
    result = await session.execute(
        select(Subscriber).where(Subscriber.phone_hash == phone_hash)
    )
    records = result.scalars().all()
    count = 0
    for rec in records:
        await session.delete(rec)
        count += 1
    await session.commit()
    return count
