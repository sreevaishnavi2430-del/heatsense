"""SQLAlchemy models for persistent storage."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Ward(Base):
    __tablename__ = "wards"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    name_telugu = Column(String(128), nullable=True)
    name_hindi = Column(String(128), nullable=True)
    zone = Column(String(64), nullable=False, index=True)
    centroid_lat = Column(Float, nullable=False)
    centroid_lng = Column(Float, nullable=False)
    polygon = Column(JSON, nullable=False)  # list of [lat, lng]
    population = Column(Integer, nullable=False, default=0)
    population_density_per_sq_km = Column(Float, nullable=False, default=0.0)
    land_surface_temp_c = Column(Float, nullable=False, default=0.0)
    night_temp_c = Column(Float, nullable=False, default=0.0)
    air_temp_estimate_c = Column(Float, nullable=False, default=0.0)
    tree_cover_percent = Column(Float, nullable=False, default=0.0)
    built_up_percent = Column(Float, nullable=False, default=0.0)
    peak_power_demand_mw = Column(Float, nullable=False, default=0.0)
    peak_demand_stress_index = Column(Float, nullable=False, default=0.0)
    transformer_overload_risk = Column(String(32), nullable=False, default="Low")
    vulnerability = Column(JSON, nullable=False, default=dict)
    amenities = Column(JSON, nullable=False, default=dict)
    hourly_temp = Column(JSON, nullable=False, default=list)
    hourly_demand_mw = Column(JSON, nullable=False, default=list)
    data_quality = Column(JSON, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    subscribers = relationship("Subscriber", back_populates="ward", cascade="all, delete-orphan")
    sensor_readings = relationship("SensorReading", back_populates="ward")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "nameTelugu": self.name_telugu or self.name,
            "nameHindi": self.name_hindi or self.name,
            "zone": self.zone,
            "centroid": [self.centroid_lat, self.centroid_lng],
            "polygon": self.polygon or [],
            "population": self.population,
            "populationDensityPerSqKm": self.population_density_per_sq_km,
            "landSurfaceTempC": self.land_surface_temp_c,
            "nightTempC": self.night_temp_c,
            "airTempEstimateC": self.air_temp_estimate_c,
            "treeCoverPercent": self.tree_cover_percent,
            "builtUpPercent": self.built_up_percent,
            "peakPowerDemandMW": self.peak_power_demand_mw,
            "peakDemandStressIndex": self.peak_demand_stress_index,
            "transformerOverloadRisk": self.transformer_overload_risk,
            "vulnerability": self.vulnerability or {},
            "amenities": self.amenities or {},
            "hourlyTemp": self.hourly_temp or [],
            "hourlyDemandMW": self.hourly_demand_mw or [],
            "dataQuality": self.data_quality or {
                "overall": "sample",
                "temperature": "sample",
                "vegetation": "sample",
                "builtUp": "sample",
                "population": "sample",
                "vulnerability": "proxy",
                "power": "modelled",
            },
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Ward":
        centroid = data.get("centroid", [17.3850, 78.4867])
        return cls(
            id=data["id"],
            name=data["name"],
            name_telugu=data.get("nameTelugu"),
            name_hindi=data.get("nameHindi"),
            zone=data.get("zone", "Central"),
            centroid_lat=float(centroid[0]),
            centroid_lng=float(centroid[1]),
            polygon=data.get("polygon", []),
            population=int(data.get("population", 0)),
            population_density_per_sq_km=float(data.get("populationDensityPerSqKm", 0.0)),
            land_surface_temp_c=float(data.get("landSurfaceTempC", 0.0)),
            night_temp_c=float(data.get("nightTempC", 0.0)),
            air_temp_estimate_c=float(data.get("airTempEstimateC", 0.0)),
            tree_cover_percent=float(data.get("treeCoverPercent", 0.0)),
            built_up_percent=float(data.get("builtUpPercent", 0.0)),
            peak_power_demand_mw=float(data.get("peakPowerDemandMW", 0.0)),
            peak_demand_stress_index=float(data.get("peakDemandStressIndex", 0.0)),
            transformer_overload_risk=str(data.get("transformerOverloadRisk", "Low")),
            vulnerability=data.get("vulnerability", {}),
            amenities=data.get("amenities", {}),
            hourly_temp=data.get("hourlyTemp", []),
            hourly_demand_mw=data.get("hourlyDemandMW", []),
            data_quality=data.get("dataQuality"),
        )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(64), primary_key=True, index=True)
    level = Column(String(32), nullable=False, index=True)
    title = Column(String(256), nullable=False)
    message = Column(Text, nullable=False)
    message_telugu = Column(Text, nullable=True)
    message_hindi = Column(Text, nullable=True)
    ward_ids = Column(JSON, nullable=False, default=list)
    ward_names = Column(JSON, nullable=False, default=list)
    channels = Column(JSON, nullable=False, default=list)
    language = Column(String(16), nullable=False, default="en")
    target_audience = Column(JSON, nullable=False, default=list)
    recipients_count = Column(Integer, nullable=False, default=0)
    delivered_percent = Column(Float, nullable=False, default=0.0)
    status = Column(String(32), nullable=False, default="sent", index=True)
    scheduled_for = Column(String(64), nullable=True)
    timestamp = Column(String(64), nullable=False, default=lambda: _utc_now().isoformat())
    created_at = Column(DateTime(timezone=True), default=_utc_now)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "level": self.level,
            "title": self.title,
            "message": self.message,
            "messageTelugu": self.message_telugu,
            "messageHindi": self.message_hindi,
            "wardIds": self.ward_ids or [],
            "wardNames": self.ward_names or [],
            "channels": self.channels or ["SMS"],
            "language": self.language or "en",
            "targetAudience": self.target_audience or ["residents"],
            "recipientsCount": self.recipients_count,
            "deliveredPercent": self.delivered_percent,
            "status": self.status,
            "scheduledFor": self.scheduled_for,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Alert":
        return cls(
            id=data["id"],
            level=data.get("level", "Yellow"),
            title=data.get("title", "Heat Alert"),
            message=data.get("message", ""),
            message_telugu=data.get("messageTelugu"),
            message_hindi=data.get("messageHindi"),
            ward_ids=data.get("wardIds", []),
            ward_names=data.get("wardNames", []),
            channels=data.get("channels", ["SMS"]),
            language=data.get("language", "en"),
            target_audience=data.get("targetAudience", ["residents"]),
            recipients_count=int(data.get("recipientsCount", 0)),
            delivered_percent=float(data.get("deliveredPercent", 0.0)),
            status=data.get("status", "sent"),
            scheduled_for=data.get("scheduledFor"),
            timestamp=data.get("timestamp") or _utc_now().isoformat(),
        )


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=False, default="Resident")
    phone_hash = Column(String(64), nullable=False, unique=True, index=True)
    phone_encrypted = Column(Text, nullable=False)
    ward_id = Column(String(64), ForeignKey("wards.id", ondelete="SET NULL"), nullable=True, index=True)
    language = Column(String(16), nullable=False, default="en")
    role = Column(String(64), nullable=False, default="resident")
    channel = Column(String(32), nullable=False, default="SMS")
    consent = Column(Boolean, nullable=False, default=True)
    active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), default=_utc_now)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)

    ward = relationship("Ward", back_populates="subscribers")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "wardId": self.ward_id,
            "language": self.language,
            "role": self.role,
            "channel": self.channel,
            "consent": self.consent,
            "active": self.active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Plan(Base):
    __tablename__ = "plans"

    id = Column(String(64), primary_key=True, index=True)
    short_code = Column(String(32), nullable=False, unique=True, index=True)
    name = Column(String(256), nullable=False, default="Heat plan")
    items = Column(JSON, nullable=False, default=list)
    totals = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=_utc_now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "shortCode": self.short_code,
            "name": self.name,
            "items": self.items or [],
            "totals": self.totals or {},
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(128), nullable=True)
    ward_id = Column(String(64), ForeignKey("wards.id", ondelete="SET NULL"), nullable=True, index=True)
    key_hash = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), default=_utc_now)

    readings = relationship("SensorReading", back_populates="device", cascade="all, delete-orphan")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "wardId": self.ward_id,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(64), ForeignKey("devices.id", ondelete="CASCADE"), nullable=True, index=True)
    ward_id = Column(String(64), ForeignKey("wards.id", ondelete="SET NULL"), nullable=True, index=True)
    temp_c = Column(Float, nullable=False)
    humidity = Column(Float, nullable=True)
    battery_v = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=_utc_now, index=True)

    device = relationship("Device", back_populates="readings")
    ward = relationship("Ward", back_populates="sensor_readings")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "deviceId": self.device_id,
            "wardId": self.ward_id,
            "tempC": self.temp_c,
            "humidity": self.humidity,
            "batteryV": self.battery_v,
            "recordedAt": self.recorded_at.isoformat() if self.recorded_at else None,
        }


class AlertTemplate(Base):
    __tablename__ = "alert_templates"

    id = Column(String(64), primary_key=True, index=True)
    level = Column(String(32), nullable=False)
    language = Column(String(16), nullable=False)
    title = Column(String(256), nullable=False)
    body = Column(Text, nullable=False)
    tips = Column(JSON, nullable=False, default=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "level": self.level,
            "language": self.language,
            "title": self.title,
            "body": self.body,
            "tips": self.tips or [],
        }


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    condition = Column(JSON, nullable=False, default=dict)
    level = Column(String(32), nullable=False)
    wards_scope = Column(String(64), nullable=False, default="allSevere")
    enabled = Column(Boolean, nullable=False, default=True)
    auto_send = Column(Boolean, nullable=False, default=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "condition": self.condition or {},
            "level": self.level,
            "wardsScope": self.wards_scope,
            "enabled": self.enabled,
            "autoSend": self.auto_send,
        }


class CitySetting(Base):
    __tablename__ = "city_settings"

    key = Column(String(64), primary_key=True, index=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)


class IngestionRun(Base):
    __tablename__ = "ingestion_runs"

    id = Column(String(64), primary_key=True, index=True)
    pipeline_name = Column(String(64), nullable=False, index=True)
    status = Column(String(32), nullable=False)  # "running", "success", "failed"
    records_processed = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True), default=_utc_now)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
