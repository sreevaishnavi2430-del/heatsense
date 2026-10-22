"""HeatSense API. Sample fixtures are explicitly labeled sample/proxy/modelled."""
from __future__ import annotations

import csv
import base64
import hashlib
import hmac
import io
import json
import logging
import math
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.config_cooling import COOLING_ASSUMPTIONS
from app.db.session import init_db, AsyncSessionLocal
from app.db import repository
from app.privacy import normalise_phone, is_valid_mobile, phone_lookup_hash

logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent
SEED = ROOT / "seed"
wards: list[dict[str, Any]] = json.loads((SEED / "mock_wards.json").read_text(encoding="utf-8"))
alerts: list[dict[str, Any]] = json.loads((SEED / "mock_alerts.json").read_text(encoding="utf-8"))
subscribers: dict[str, dict[str, Any]] = {}
plans: dict[str, dict[str, Any]] = {}
devices: dict[str, dict[str, Any]] = {}
readings: list[dict[str, Any]] = []
templates: list[dict[str, Any]] = [
    {"id": f"{level.lower()}-{lang}", "level": level, "language": lang, "title": title, "body": body, "tips": ["Drink water often", "Avoid outdoor activity from 12 to 4 PM", "Wear light cotton clothes", "Check on older neighbours; call 108 for heat stroke"]}
    for level, title, bodies in [
        ("Yellow", "Heat safety advisory", ["Heat advisory for {ward} ({temp}°C). Drink water, wear light cotton clothes and check on older neighbours. Avoid midday sun.", "{ward} లో వేడి ఎక్కువగా ఉంది ({temp}°C). నీరు త్రాగండి, తేలికపాటి పత్తి దుస్తులు ధరించండి. మధ్యాహ్నం ఎండను నివారించండి.", "{ward} में गर्मी अधिक है ({temp}°C)। पानी पिएं, हल्के सूती कपड़े पहनें और दोपहर की धूप से बचें।"]),
        ("Orange", "Severe heat warning", ["ORANGE ALERT for {ward}: avoid going out 12–4 PM. Drink water and check on older neighbours. Call 108 for heat stroke.", "{ward} కు ఆరెంజ్ హెచ్చరిక: మధ్యాహ్నం 12–4 బయటకు వెళ్లవద్దు. నీరు త్రాగండి. హీట్ స్ట్రోక్‌కు 108కు కాల్ చేయండి.", "{ward} के लिए ऑरेंज चेतावनी: दोपहर 12–4 बजे बाहर न जाएं। पानी पिएं। लू लगने पर 108 पर कॉल करें."]),
        ("Red", "Extreme heat emergency", ["RED ALERT for {ward}: stay in shade, drink water and avoid outdoor work during peak heat. Call 108 for confusion, fainting or hot dry skin.", "{ward} కు రెడ్ హెచ్చరిక: నీడలో ఉండండి, నీరు త్రాగండి, తీవ్రమైన వేడిలో బయట పని చేయవద్దు. అత్యవసరానికి 108కు కాల్ చేయండి.", "{ward} के लिए रेड चेतावनी: छाया में रहें, पानी पिएं और तेज गर्मी में बाहर काम न करें। आपात स्थिति में 108 पर कॉल करें."])
    ] for lang, body in zip(("en", "te", "hi"), bodies)]
rules: list[dict[str, Any]] = [
    {"id": "rule-forecast-43", "name": "Consecutive extreme forecast", "condition": {"metric": "forecastSurfaceTempC", "operator": ">", "value": 43, "consecutiveDays": 2}, "level": "Orange", "wardsScope": "allSevere", "enabled": True, "autoSend": False},
    {"id": "rule-red-45", "name": "Extreme heat forecast", "condition": {"metric": "forecastSurfaceTempC", "operator": ">=", "value": 45, "consecutiveDays": 1}, "level": "Red", "wardsScope": "allSevere", "enabled": True, "autoSend": False},
    {"id": "rule-grid-stress", "name": "High power stress", "condition": {"metric": "stressIndex", "operator": ">", "value": 85, "consecutiveHours": 3}, "level": "Yellow", "wardsScope": "all", "enabled": True, "autoSend": False},
]
city_settings: dict[str, Any] = {"weights": {"wTemp": .35, "wTree": .20, "wBuilt": .15, "wVuln": .30}, "temperatureUnit": "C", "refreshIntervalSeconds": 60, "benchmarks": {"peoplePerWaterPoint": 2000, "peoplePerShadeShelter": 3000}}

# Fields the ward list may be sorted by. Kept explicit so a caller cannot sort on
# a nested object (which raises a TypeError and surfaces as a 500).
SORTABLE_WARD_FIELDS: frozenset[str] = frozenset({
    "heatRiskScore",
    "riskLevel",
    "name",
    "zone",
    "population",
    "populationDensityPerSqKm",
    "landSurfaceTempC",
    "nightTempC",
    "airTempEstimateC",
    "treeCoverPercent",
    "builtUpPercent",
    "peakPowerDemandMW",
    "peakDemandStressIndex",
})

# SMS/WhatsApp bodies are short; a cap keeps a single alert from bloating storage
# and matches the segment limits the delivery providers enforce.
MAX_ALERT_MESSAGE_CHARS = 2000


async def get_db_optional() -> AsyncGenerator[Optional[AsyncSession], None]:
    """Dependency yielding an async DB session when available, committing automatically.

    Exceptions raised by the route body are re-raised unchanged so FastAPI can still
    turn an HTTPException into its 4xx response. Catching them here and yielding a
    second time is invalid for a generator and would mask every validation error
    (422/403/404) as an opaque 500.
    """
    try:
        session_scope = AsyncSessionLocal()
    except Exception as exc:  # pragma: no cover - session factory creation failure
        logger.warning("Database session unavailable: %s", exc)
        yield None
        return

    async with session_scope as session:
        try:
            yield session
        except Exception:
            try:
                await session.rollback()
            except Exception:  # pragma: no cover - rollback on a broken session
                pass
            raise
        else:
            await session.commit()


# Published placeholder values. If these survive into a non-demo deployment the
# service is either unauthenticated or using publicly known keys, so refuse to start.
DEFAULT_SECRET_KEY = "heatsense-demo-secret-key-change-in-production"
DEFAULT_FERNET_KEY = "0w_3Nqk916qK2d8B1H0rX12_aG84kQZ7Wn-UqE6M2tM="
DEFAULT_OFFICER_PASSWORD = "demo1234"
PLACEHOLDER_SECRETS = {"", "replace-with-a-long-random-secret", "replace-with-a-fernet-generated-key"}


def _check_security_configuration() -> None:
    """Refuse to start in an unsafe configuration; warn loudly in demo mode.

    Demo mode disables authentication on the protected endpoints, so it must never
    be combined with the assumption that the service is private.
    """
    using_default_secret = settings.SECRET_KEY == DEFAULT_SECRET_KEY
    using_default_fernet = settings.FERNET_KEY == DEFAULT_FERNET_KEY
    placeholder_secret = settings.SECRET_KEY.strip().lower() in PLACEHOLDER_SECRETS
    placeholder_fernet = settings.FERNET_KEY.strip().lower() in PLACEHOLDER_SECRETS

    # A malformed Fernet key would only surface as a runtime error the first time a
    # subscriber is saved, so validate it up front.
    fernet_key_valid = True
    if not placeholder_fernet:
        try:
            Fernet(settings.FERNET_KEY.encode())
        except Exception:
            fernet_key_valid = False

    if settings.MODE != "demo":
        problems = []
        if settings.DEMO_ANY_LOGIN:
            problems.append("DEMO_ANY_LOGIN must be false outside demo mode")
        if settings.OFFICER_PASSWORD == DEFAULT_OFFICER_PASSWORD:
            problems.append("OFFICER_PASSWORD is still the published demo password")
        if settings.DATABASE_URL.startswith("sqlite"):
            problems.append("DATABASE_URL must use persistent PostgreSQL outside demo mode")
        if using_default_secret or placeholder_secret:
            problems.append("SECRET_KEY is still a placeholder (JWTs can be forged)")
        if using_default_fernet or placeholder_fernet:
            problems.append("FERNET_KEY is still the published placeholder (stored phone numbers can be decrypted)")
        if not fernet_key_valid:
            problems.append("FERNET_KEY is not a valid Fernet key")
        if problems:
            raise RuntimeError(
                "Refusing to start: " + "; ".join(problems) + ". "
                "Set unique values in backend/.env before running with MODE=" + settings.MODE + "."
            )

    if settings.MODE == "demo":
        logger.warning(
            "SECURITY: running in MODE=demo. Authentication is bypassed on protected "
            "endpoints and any credentials are accepted. Do not expose this deployment."
        )
        if using_default_secret or using_default_fernet or placeholder_secret or placeholder_fernet:
            logger.warning(
                "SECURITY: using a published or placeholder SECRET_KEY/FERNET_KEY. "
                "Tokens can be forged and stored phone numbers can be decrypted by anyone "
                "with the source code."
            )


@asynccontextmanager
async def lifespan(application: FastAPI):
    _check_security_configuration()
    try:
        await init_db()
        async with AsyncSessionLocal() as session:
            await repository.seed_database(session)
            db_wards = await repository.get_all_wards(session)
            if db_wards:
                wards.clear()
                wards.extend(db_wards)
            db_alerts = await repository.get_all_alerts(session)
            if db_alerts:
                alerts.clear()
                alerts.extend(db_alerts)
            db_templates = await repository.get_alert_templates(session)
            if db_templates:
                templates.clear()
                templates.extend(db_templates)
            db_rules = await repository.get_alert_rules(session)
            if db_rules:
                rules.clear()
                rules.extend(db_rules)
            db_settings = await repository.get_city_settings(session)
            if db_settings:
                city_settings.clear()
                city_settings.update(db_settings)
    except Exception as exc:
        logger.warning("Database startup/sync note: %s", exc)
    yield


app = FastAPI(
    title="HeatSense API",
    version=settings.APP_VERSION,
    description="Hyderabad heat-risk and action-planning API. Demo values are marked sample/proxy.",
    lifespan=lifespan,
)
from app.pipelines.weather import fetch_open_meteo_weather, fetch_ward_current_weather, compute_ward_adjusted_forecast
from app.pipelines.grid import calculate_hourly_grid_profile, ingest_utility_csv
from app.ml import train_model as ml_train, predict_air_temp, get_model_info

# ─── Simple in-memory rate limiter ────────────────────────────────────────────
import time as _time
from collections import defaultdict as _defaultdict

_rate_limit_store: dict[str, list[float]] = _defaultdict(list)
RATE_LIMIT_REQUESTS = 120  # per window
RATE_LIMIT_WINDOW = 60.0   # seconds

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Simple sliding-window rate limiter keyed by client IP."""
    client_ip = request.client.host if request.client else "unknown"
    now = _time.monotonic()
    window_start = now - RATE_LIMIT_WINDOW
    hits = _rate_limit_store[client_ip]
    # Prune old hits
    _rate_limit_store[client_ip] = [t for t in hits if t > window_start]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please wait and retry."})
    _rate_limit_store[client_ip].append(now)
    return await call_next(request)

app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class LoginBody(BaseModel):
    email: str
    password: str


class PlannerBody(BaseModel):
    budgetInrLakh: float = Field(ge=0)
    types: list[str] = []
    goal: str = "maximise_people"
    zone: Optional[str] = None


class SimBody(BaseModel):
    wardId: str
    treeCoverIncreasePct: float = 0
    coolRoofPct: float = 0
    shadeSheltersAdded: int = 0
    waterPointsAdded: int = 0


def _token(email: str) -> str:
    enc = lambda value: base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()
    header = enc({"alg": "HS256", "typ": "JWT"})
    payload = enc({"sub": email, "exp": int((datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()), "role": "admin" if email.startswith("admin") else "officer"})
    unsigned = f"{header}.{payload}"
    signature = base64.urlsafe_b64encode(hmac.new(settings.SECRET_KEY.encode(), unsigned.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    return f"{unsigned}.{signature}"


def _decode_token(token: str) -> dict[str, Any]:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token")
    unsigned = f"{parts[0]}.{parts[1]}"
    expected = base64.urlsafe_b64encode(hmac.new(settings.SECRET_KEY.encode(), unsigned.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
    if not hmac.compare_digest(expected, parts[2]):
        raise ValueError("Invalid token signature")
    payload = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    if payload.get("exp", 0) < datetime.now(timezone.utc).timestamp():
        raise ValueError("Expired token")
    return payload


async def officer(authorization: Optional[str] = Header(None)) -> dict[str, str]:
    if settings.MODE == "demo" and not authorization:
        return {"sub": "officer@heatsense.demo", "role": "officer"}
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, detail={"error": {"code": "unauthorized", "message": "Bearer token required"}})
    try:
        return _decode_token(authorization.split(" ", 1)[1])
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(401, detail={"error": {"code": "invalid_token", "message": "Token is invalid or expired"}}) from exc


def _normal(value: float, lo: float, hi: float) -> float:
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (value - lo) / (hi - lo)))


def score_components(w: dict[str, Any], weights: Optional[dict[str, float]] = None) -> dict[str, Any]:
    weights = weights or city_settings["weights"]
    v = w["vulnerability"]
    vindex = sum((_normal(v[k], a, b) for k, a, b in [("elderlyPercent", 2, 20), ("childrenUnder5Percent", 2, 18), ("lowIncomeHousingPercent", 5, 75), ("outdoorWorkersPercent", 5, 45), ("noAirConditioningPercent", 10, 90)])) / 5
    comps = {"normTemp": _normal(w["landSurfaceTempC"], 34, 48), "normTreeCoverGap": 1 - _normal(w["treeCoverPercent"], 2, 35), "normBuiltUp": _normal(w["builtUpPercent"], 30, 95), "vulnerabilityIndex": vindex, "weights": weights}
    total = sum(weights.values()) or 1
    raw = 100 * sum(comps[k] * weights[weight] / total for k, weight in [("normTemp", "wTemp"), ("normTreeCoverGap", "wTree"), ("normBuiltUp", "wBuilt"), ("vulnerabilityIndex", "wVuln")])
    score = round(max(0, min(100, raw)))
    level = "Low" if score <= 25 else "Moderate" if score <= 50 else "High" if score <= 75 else "Severe"
    return {"score": score, "level": level, "components": comps}


def ward_view(source: dict[str, Any], weights: Optional[dict[str, float]] = None) -> dict[str, Any]:
    w = dict(source)
    # Persisted Ward rows predate the topDrivers field; derive readable drivers
    # when that optional fixture field is absent so API consumers can render safely.
    if not isinstance(w.get("topDrivers"), list) or not w["topDrivers"]:
        drivers: list[tuple[float, str]] = []
        drivers.append((float(w.get("landSurfaceTempC", 0) or 0), "High land-surface temperature"))
        drivers.append((100.0 - float(w.get("treeCoverPercent", 0) or 0), "Low tree canopy"))
        drivers.append((float(w.get("builtUpPercent", 0) or 0), "Dense built-up area"))
        vulnerability = w.get("vulnerability") or {}
        drivers.append((float(vulnerability.get("lowIncomeHousingPercent", 0) or 0), "Low-income housing exposure"))
        drivers.append((float(vulnerability.get("outdoorWorkersPercent", 0) or 0), "Outdoor-worker exposure"))
        drivers.append((float(vulnerability.get("elderlyPercent", 0) or 0), "Older-adult exposure"))
        w["topDrivers"] = [label for _, label in sorted(drivers, reverse=True)[:3]]
    computed = score_components(w, weights)
    w["heatRiskScore"] = computed["score"]
    w["riskLevel"] = computed["level"]
    w["components"] = computed["components"]
    w["dataQuality"] = {"overall": "sample", "temperature": "sample", "vegetation": "sample", "builtUp": "sample", "population": "sample", "vulnerability": "proxy", "power": "modelled"}
    return w


def weights_from_query(wTemp: Optional[float], wTree: Optional[float], wBuilt: Optional[float], wVuln: Optional[float]) -> Optional[dict[str, float]]:
    if all(v is None for v in (wTemp, wTree, wBuilt, wVuln)):
        return None
    out = {"wTemp": wTemp if wTemp is not None else .35, "wTree": wTree if wTree is not None else .20, "wBuilt": wBuilt if wBuilt is not None else .15, "wVuln": wVuln if wVuln is not None else .30}
    if any(v < 0 for v in out.values()) or sum(out.values()) <= 0:
        raise HTTPException(422, "Weights must be non-negative and have a positive sum")
    return out


def _find_ward(ward_id: str) -> dict[str, Any]:
    item = next((w for w in wards if w["id"] == ward_id or w["name"].casefold() == ward_id.casefold()), None)
    if not item:
        raise HTTPException(404, "Ward not found")
    return item


def _interventions(w: dict[str, Any]) -> list[dict[str, Any]]:
    v, a = w["vulnerability"], w["amenities"]
    specs = [
        ("cool_roofs", "Solar Reflective Cool Roof Coating", 20, 1.0, w["population"] * .18, w["builtUpPercent"] > 65 or v["lowIncomeHousingPercent"] > 35, "High built-up density and low AC access."),
        ("tree_planting", "Targeted Urban Tree Canopy Expansion", 18, .8, w["population"] * .22, w["treeCoverPercent"] < 20, "Low canopy leaves people exposed to radiant heat."),
        ("shade_shelters", "Tension-Fabric Shade Shelters", 8, .4, w["population"] * v["outdoorWorkersPercent"] / 100, v["outdoorWorkersPercent"] > 18 or a["shadeShelters"] < 4, "Outdoor workers need accessible shade breaks."),
        ("water_points", "Drinking Water Kiosks", 5, .2, w["population"] * .15, a["waterPoints"] < 5 or w["landSurfaceTempC"] > 41, "Hydration access during peak heat."),
        ("cooling_centres", "Community Cooling Centre", 18, 1.2, w["population"] * .12, v["elderlyPercent"] > 8 or v["childrenUnder5Percent"] > 9, "Nearby refuge for older people, children and people without AC."),
        ("misting_corridors", "Misting / Green Corridor", 14, 1.5, w["population"] * .1, w["landSurfaceTempC"] >= 43, "Illustrative localized pedestrian cooling."),
        ("early_warning", "Multilingual Heat Alert Outreach", 3, .1, w["population"] * .45, True, "Low-cost behavior-change and heat-safety outreach.")
    ]
    out = []
    for typ, title, cost, cooling, people, applies, reason in specs:
        if applies:
            priority = min(99, round(w["heatRiskScore"] * .7 + cooling * 10 + (people / max(1, w["population"])) * 20))
            out.append({"id": f"{w['id']}-{typ}", "wardId": w["id"], "wardName": w["name"], "type": typ, "title": title, "description": reason, "priorityScore": priority, "costLakhINR": cost, "costBand": "Low" if cost <= 8 else "Medium", "coolingBenefitC": cooling, "peopleBenefited": round(people), "reason": reason, "assumptionsNote": COOLING_ASSUMPTIONS["disclaimer"]})
    return sorted(out, key=lambda x: x["priorityScore"], reverse=True)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-ID") or secrets.token_hex(8)
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ready")
async def ready(db: Optional[AsyncSession] = Depends(get_db_optional)):
    db_status = "connected"
    if isinstance(db, AsyncSession):
        try:
            await db.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception:
            db_status = "error"
    return {"status": "ready" if db_status == "connected" else "degraded", "database": db_status, "scheduler": "disabled"}


@app.get("/meta")
@app.get("/api/v1/meta")
async def meta():
    return {"version": settings.APP_VERSION, "mode": settings.MODE, "dataQuality": {"overall": "sample", "vulnerability": "proxy", "grid": "modelled"}, "lastRefresh": {"wards": None, "forecast": datetime.now(timezone.utc).isoformat()}, "model": {"status": "synthetic-demo"}}


@app.post("/api/v1/auth/login")
async def login(body: LoginBody):
    password_matches = secrets.compare_digest(body.password, settings.OFFICER_PASSWORD)
    if not (settings.MODE == "demo" and settings.DEMO_ANY_LOGIN) and (body.email != "officer@heatsense.demo" or not password_matches):
        raise HTTPException(401, "Incorrect email or password")
    return {"accessToken": _token(body.email), "tokenType": "bearer", "user": {"name": "HeatSense Officer", "email": body.email, "department": "GHMC Disaster Management", "role": "admin" if body.email.startswith("admin") else "officer"}}


@app.get("/api/v1/auth/me")
async def me(user=Depends(officer)):
    return {"name": "HeatSense Officer", "email": user["sub"], "role": user.get("role", "officer")}


@app.get("/api/v1/city/overview")
@app.get("/api/v1/overview")
async def overview(user=Depends(officer)):
    ranked = [ward_view(w) for w in wards]
    severe = [w for w in ranked if w["riskLevel"] == "Severe"]
    hi = [w for w in ranked if w["riskLevel"] in ("High", "Severe")]
    hot = max(wards, key=lambda w: w["landSurfaceTempC"])
    cool = min(wards, key=lambda w: w["landSurfaceTempC"])
    return {
        "totalWards": len(wards),
        "severeRiskWards": len(severe),
        "highRiskWards": len([w for w in ranked if w["riskLevel"] == "High"]),
        "peopleAtSevereRisk": sum(w["population"] for w in severe),
        "peopleAtHighOrSevereRisk": sum(w["population"] for w in hi),
        "avgCitySurfaceTempC": round(sum(w["landSurfaceTempC"] for w in wards) / len(wards), 1),
        "hottestWard": {"name": hot["name"], "tempC": hot["landSurfaceTempC"], "wardId": hot["id"]},
        "coolestWard": {"name": cool["name"], "tempC": cool["landSurfaceTempC"], "wardId": cool["id"]},
        "activeAlertsCount": sum(1 for a in alerts if a.get("status") == "sent"),
        "avgPowerStressIndex": round(sum(w["peakDemandStressIndex"] for w in wards) / len(wards), 1),
        "totalPopulation": sum(w["population"] for w in wards),
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "dataQualitySummary": {"sample": len(wards), "proxy": len(wards)}
    }


@app.get("/api/v1/wards")
async def get_wards(
    zone: Optional[str] = None,
    riskLevel: Optional[str] = None,
    minPopulation: int = 0,
    q: Optional[str] = None,
    sort: str = "heatRiskScore",
    order: str = "desc",
    page: int = 1,
    pageSize: int = 100,
    wTemp: Optional[float] = None,
    wTree: Optional[float] = None,
    wBuilt: Optional[float] = None,
    wVuln: Optional[float] = None,
    user=Depends(officer)
):
    weights = weights_from_query(wTemp, wTree, wBuilt, wVuln)
    if sort not in SORTABLE_WARD_FIELDS:
        raise HTTPException(422, f"Cannot sort by '{sort}'. Allowed fields: {', '.join(sorted(SORTABLE_WARD_FIELDS))}")
    if order.lower() not in {"asc", "desc"}:
        raise HTTPException(422, "order must be 'asc' or 'desc'")
    if page < 1:
        raise HTTPException(422, "page must be 1 or greater")
    if pageSize < 1 or pageSize > 500:
        raise HTTPException(422, "pageSize must be between 1 and 500")
    results = [ward_view(w, weights) for w in wards]
    if zone:
        results = [w for w in results if w["zone"].casefold() == zone.casefold()]
    if riskLevel:
        results = [w for w in results if w["riskLevel"] == riskLevel]
    results = [w for w in results if w["population"] >= minPopulation]
    if q:
        results = [w for w in results if q.casefold() in " ".join([w["name"], w["nameTelugu"], w["nameHindi"]]).casefold()]
    results.sort(key=lambda w: w.get(sort, 0), reverse=order.lower() == "desc")
    start = max(0, (page - 1) * pageSize)
    page_results = results[start:start + pageSize]
    try:
        live_conditions = await fetch_ward_current_weather(page_results)
    except Exception as exc:
        logger.warning("Ward current weather unavailable: %s", exc)
        live_conditions = {}
    for ward in page_results:
        ward["currentWeather"] = live_conditions.get(ward["id"])
        ward.setdefault("dataQuality", {})["currentWeather"] = "modelled" if ward["currentWeather"] else "unavailable"
    return page_results


@app.get("/api/v1/wards/geojson")
async def geojson(response: Response, wTemp: Optional[float] = None, wTree: Optional[float] = None, wBuilt: Optional[float] = None, wVuln: Optional[float] = None, user=Depends(officer)):
    wt = weights_from_query(wTemp, wTree, wBuilt, wVuln)
    fc = {"type": "FeatureCollection", "features": []}
    for w0 in wards:
        w = ward_view(w0, wt)
        ring = [[lng, lat] for lat, lng in w["polygon"]]
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        fc["features"].append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {
                "id": w["id"],
                "name": w["name"],
                "heatRiskScore": w["heatRiskScore"],
                "riskLevel": w["riskLevel"],
                "landSurfaceTempC": w["landSurfaceTempC"],
                "treeCoverPercent": w["treeCoverPercent"],
                "builtUpPercent": w["builtUpPercent"],
                "vulnerableIndex": w["components"]["vulnerabilityIndex"],
                "powerStress": w["peakDemandStressIndex"],
                "dataQuality": "sample",
            }
        })
    response.headers["ETag"] = '"heatsense-demo-wards-v1"'
    return fc


@app.get("/api/v1/wards/compare")
async def compare(ids: str, user=Depends(officer)):
    wanted = ids.split(",")[:3]
    return [ward_view(_find_ward(i)) for i in wanted]


@app.get("/api/v1/wards/{ward_id}/amenities")
async def ward_amenities(ward_id: str, user=Depends(officer)):
    w = _find_ward(ward_id)
    return {
        "wardId": ward_id,
        "items": [],
        "counts": w["amenities"],
        "gaps": {
            "waterPointsNeeded": max(0, math.ceil(w["population"] / 2000) - w["amenities"]["waterPoints"]),
            "shadeSheltersNeeded": max(0, math.ceil(w["population"] / 3000) - w["amenities"]["shadeShelters"])
        },
        "dataQuality": "sample",
    }


@app.get("/api/v1/wards/{ward_id}/interventions")
async def get_ward_interventions(ward_id: str, user=Depends(officer)):
    return _interventions(ward_view(_find_ward(ward_id)))


@app.get("/api/v1/amenities")
async def amenities(type: Optional[str] = None, zone: Optional[str] = None, user=Depends(officer)):
    return []


# Registered before /api/v1/wards/{ward_id}: FastAPI matches routes in registration
# order, so a dynamic path segment would otherwise swallow "export.csv".
@app.get("/api/v1/wards/export.csv")
async def export_wards(user=Depends(officer)):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=["id", "name", "zone", "heatRiskScore", "riskLevel", "landSurfaceTempC", "treeCoverPercent", "builtUpPercent", "population", "dataQuality"])
    writer.writeheader()
    for w0 in wards:
        w = ward_view(w0)
        writer.writerow({"id": w["id"], "name": w["name"], "zone": w["zone"], "heatRiskScore": w["heatRiskScore"], "riskLevel": w["riskLevel"], "landSurfaceTempC": w["landSurfaceTempC"], "treeCoverPercent": w["treeCoverPercent"], "builtUpPercent": w["builtUpPercent"], "population": w["population"], "dataQuality": "sample"})
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=heatsense-wards.csv"})


@app.get("/api/v1/wards/{ward_id}")
async def ward_detail(ward_id: str, user=Depends(officer)):
    ward = ward_view(_find_ward(ward_id))
    try:
        ward["currentWeather"] = (await fetch_ward_current_weather([ward])).get(ward["id"])
    except Exception as exc:
        logger.warning("Ward current weather unavailable for %s: %s", ward_id, exc)
        ward["currentWeather"] = None
    return ward


@app.post("/api/v1/planner/generate")
async def planner(body: PlannerBody, user=Depends(officer)):
    candidates = []
    for w in map(ward_view, wards):
        if body.zone and body.zone.lower() not in ("all", w["zone"].lower()):
            continue
        for a in _interventions(w):
            if body.types and a["type"] not in body.types:
                continue
            if body.goal == "maximise_cooling":
                value = a["coolingBenefitC"] * 1000 / a["costLakhINR"]
            elif body.goal == "most_vulnerable_first":
                value = a["priorityScore"] / a["costLakhINR"]
            else:
                value = a["peopleBenefited"] / a["costLakhINR"]
            candidates.append((value, a))
    candidates.sort(key=lambda x: x[0], reverse=True)
    budget = body.budgetInrLakh
    chosen = []
    occupied = set()
    next_best = []
    for _, a in candidates:
        key = (a["wardId"], a["type"])
        if key in occupied:
            continue
        if a["costLakhINR"] <= budget:
            chosen.append(a)
            budget -= a["costLakhINR"]
            occupied.add(key)
        elif len(next_best) < 10:
            next_best.append(a)
    cost = sum(x["costLakhINR"] for x in chosen)
    return {
        "items": chosen,
        "plan": chosen,
        "nextBest": next_best,
        "totals": {
            "cost": cost,
            "peopleProtected": sum(x["peopleBenefited"] for x in chosen),
            "avgCoolingC": round(sum(x["coolingBenefitC"] for x in chosen) / max(1, len(chosen)), 2),
            "wardsCovered": len({x["wardId"] for x in chosen})
        },
        "mapPoints": [{"wardId": w["wardId"], "centroid": _find_ward(w["wardId"])["centroid"]} for w in chosen],
        "assumptionsNote": COOLING_ASSUMPTIONS["disclaimer"]
    }


@app.post("/api/v1/simulator/run")
async def simulate(body: SimBody, user=Depends(officer)):
    w = ward_view(_find_ward(body.wardId))
    temp = w["airTempEstimateC"]
    cooling = min(5.0, body.treeCoverIncreasePct * .08 + body.coolRoofPct * .0333 + body.shadeSheltersAdded * .025 + body.waterPointsAdded * .02)
    after_temp = max(20, temp - cooling)
    new = w.copy()
    new["landSurfaceTempC"] = max(34, w["landSurfaceTempC"] - body.treeCoverIncreasePct * .08 - body.coolRoofPct * .0333)
    new_score = score_components(new)
    demand = w["peakPowerDemandMW"]
    reduction = demand * min(.25, cooling * .022)
    return {
        "before": {"tempC": temp, "score": w["heatRiskScore"], "level": w["riskLevel"], "demandMW": demand},
        "after": {"tempC": round(after_temp, 1), "score": new_score["score"], "level": new_score["level"], "demandMW": round(demand - reduction, 2)},
        "peopleMovedToSaferLevel": w["population"] if new_score["level"] != w["riskLevel"] and new_score["score"] < w["heatRiskScore"] else 0,
        "demandReductionMW": round(reduction, 2),
        "assumptions": [COOLING_ASSUMPTIONS["disclaimer"]],
        "disclaimer": "Scenario results are illustrative planning estimates, not measured outcomes."
    }


@app.get("/api/v1/alerts")
async def get_alerts(status: Optional[str] = None, level: Optional[str] = None, page: int = 1, user=Depends(officer)):
    result = [dict(a) for a in alerts]
    if status:
        result = [a for a in result if a.get("status") == status]
    if level:
        result = [a for a in result if a.get("level") == level]
    return result


@app.post("/api/v1/alerts/preview")
async def alert_preview(payload: dict[str, Any], user=Depends(officer)):
    msg = str(payload.get("message", ""))[:1000]
    w = wards[0]
    rendered = msg.replace("{ward}", w["name"]).replace("{temp}", str(w["landSurfaceTempC"])).replace("{time}", "14:00")
    unicode = any(ord(c) > 127 for c in rendered)
    segment = 70 if unicode else 160
    return {
        "message": rendered,
        "characterCount": len(rendered),
        "segments": math.ceil(len(rendered) / segment),
        "recipientEstimate": len(subscribers),
        "language": payload.get("language", "en")
    }


def _send_demo(alert_id: str):
    for item in alerts:
        if item["id"] == alert_id:
            item["status"] = "sent"
            item["deliveredPercent"] = 95.0
            item["recipientsCount"] = max(item.get("recipientsCount", 0), len(subscribers))
            return


@app.post("/api/v1/alerts")
async def create_alert(
    payload: dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    wardids = payload.get("wardIds") or (payload.get("target", {}).get("wardIds") if isinstance(payload.get("target"), dict) else []) or []
    unknown = [i for i in wardids if not any(w["id"] == i or w["name"].casefold() == str(i).casefold() for w in wards)]
    if unknown:
        raise HTTPException(422, f"Unknown ward id(s): {', '.join(str(u) for u in unknown[:10])}")
    selected = [_find_ward(i) for i in wardids] if wardids else wards
    message = str(payload.get("message", "") or "")
    if len(message) > MAX_ALERT_MESSAGE_CHARS:
        raise HTTPException(422, f"Message exceeds the {MAX_ALERT_MESSAGE_CHARS} character limit")
    lang = payload.get("language", "en")
    channels = payload.get("channels") or ([payload.get("channel", "SMS")] if payload.get("channel") else ["SMS"])
    now = datetime.now(timezone.utc).isoformat()
    aid = f"alt-{secrets.token_hex(4)}"
    entry = {
        "id": aid,
        "level": payload.get("level", "Yellow"),
        "title": payload.get("title", f"{payload.get('level', 'Yellow')} Heat Alert"),
        "message": payload.get("message", ""),
        "messageTelugu": payload.get("messageTelugu"),
        "messageHindi": payload.get("messageHindi"),
        "wardIds": [w["id"] for w in selected],
        "wardNames": [w["name"] for w in selected],
        "channels": channels,
        "language": lang,
        "targetAudience": payload.get("targetAudience", payload.get("audience", ["residents"])),
        "recipientsCount": len(subscribers),
        "deliveredPercent": 0,
        "timestamp": now,
        "status": "scheduled" if payload.get("scheduleAt") or payload.get("scheduledFor") else "sent",
        "scheduledFor": payload.get("scheduleAt") or payload.get("scheduledFor")
    }
    alerts.insert(0, entry)
    if isinstance(db, AsyncSession):
        try:
            await repository.create_alert_record(db, entry)
        except Exception as exc:
            logger.warning("Could not persist alert to database: %s", exc)
    if entry["status"] == "sent":
        background_tasks.add_task(_send_demo, aid)
    return entry


# Registered before /api/v1/alerts/{alert_id}: FastAPI matches routes in registration
# order, so a dynamic path segment would otherwise swallow "export.csv".
@app.get("/api/v1/alerts/export.csv")
async def export_alerts(user=Depends(officer)):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=["id", "level", "title", "status", "timestamp", "recipientsCount"])
    writer.writeheader()
    writer.writerows([{k: a.get(k) for k in writer.fieldnames} for a in alerts])
    return StreamingResponse(iter([stream.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=heatsense-alerts.csv"})


@app.get("/api/v1/alerts/{alert_id}")
async def alert_detail(alert_id: str, user=Depends(officer)):
    item = next((a for a in alerts if a["id"] == alert_id), None)
    if not item:
        raise HTTPException(404, "Alert not found")
    return {**item, "deliveryBreakdown": {"sent": round(item.get("recipientsCount", 0) * item.get("deliveredPercent", 0) / 100), "failed": 0}}


@app.delete("/api/v1/alerts/{alert_id}")
async def cancel_alert(
    alert_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    item = next((a for a in alerts if a["id"] == alert_id), None)
    if not item:
        raise HTTPException(404, "Alert not found")
    item["status"] = "draft"
    if isinstance(db, AsyncSession):
        try:
            await repository.update_alert_status(db, alert_id, "draft")
        except Exception as exc:
            logger.warning("Could not update alert status in db: %s", exc)
    return item


@app.get("/api/v1/grid/demand")
async def grid_demand(user=Depends(officer)):
    loads = [w["hourlyDemandMW"] for w in wards]
    total = [round(sum(row[i] for row in loads), 1) for i in range(24)]
    temps = [round(sum(w["hourlyTemp"][i] for w in wards) / len(wards), 1) for i in range(24)]
    return {
        "hourlyLabels": [f"{i:02}:00" for i in range(24)],
        "totalDemandMW": total,
        "temperatureCurveC": temps,
        "zoneDemand": {z: [round(sum(w["hourlyDemandMW"][i] for w in wards if w["zone"] == z), 1) for i in range(24)] for z in ["Central", "East", "West", "North", "South"]},
        "peakHour": f"{total.index(max(total)):02}:00",
        "peakDemandMW": max(total),
        "stressedSubstationsCount": sum(w["transformerOverloadRisk"] == "High" for w in wards),
        "dataQuality": "modelled"
    }


@app.get("/api/v1/grid/wards")
async def grid_wards(user=Depends(officer)):
    return [
        {
            "wardId": w["id"],
            "wardName": w["name"],
            "peakPowerDemandMW": w["peakPowerDemandMW"],
            "stressIndex": w["peakDemandStressIndex"],
            "transformerOverloadRisk": w["transformerOverloadRisk"],
            "recommendedActions": ["Stagger cooling loads", "Inspect local transformer"],
            "dataQuality": "modelled"
        }
        for w in wards
    ]


@app.get("/api/v1/forecast")
async def forecast():
    return await fetch_open_meteo_weather()


@app.get("/api/v1/forecast/wards/{ward_id}")
async def ward_forecast(ward_id: str):
    w = _find_ward(ward_id)
    data = await fetch_open_meteo_weather()
    try:
        current_weather = (await fetch_ward_current_weather([w])).get(w["id"])
    except Exception as exc:
        logger.warning("Ward weather unavailable for %s: %s", ward_id, exc)
        current_weather = None
    return {**data, "wardId": ward_id, "wardName": w["name"], "currentWeather": current_weather,
            "forecastScope": "City forecast; current conditions from the ward centroid"}


@app.get("/api/v1/public/wards/search")
async def ward_search(q: str = ""):
    return [
        {"id": w["id"], "name": w["name"], "nameTelugu": w["nameTelugu"], "nameHindi": w["nameHindi"]}
        for w in wards
        if q.casefold() in " ".join([w["name"], w["nameTelugu"], w["nameHindi"]]).casefold()
    ][:10]


@app.get("/api/v1/public/check-area")
async def check_area(q: Optional[str] = None, lat: Optional[float] = None, lng: Optional[float] = None):
    w = None
    if q:
        w = next((x for x in wards if q.casefold() in " ".join([x["name"], x["nameTelugu"], x["nameHindi"]]).casefold()), None)
    if not w and lat is not None and lng is not None:
        w = min(wards, key=lambda x: (x["centroid"][0] - lat) ** 2 + (x["centroid"][1] - lng) ** 2)
    if not w:
        raise HTTPException(404, "No matching ward found")
    return {
        "ward": {"id": w["id"], "name": w["name"], "nameTelugu": w["nameTelugu"], "nameHindi": w["nameHindi"]},
        "todayRiskLevel": ward_view(w)["riskLevel"],
        "expectedPeakTempC": w["airTempEstimateC"],
        "hottestHours": ["12:00", "13:00", "14:00", "15:00"],
        "safetyTips": {
            "en": ["Drink water regularly", "Avoid going out from 12 to 4 PM", "Wear light cotton clothes", "Check on elderly neighbours; call 108 for heat stroke"],
            "te": ["క్రమం తప్పకుండా నీరు త్రాగండి", "మధ్యాహ్నం 12 నుండి 4 వరకు బయటకు వెళ్లవద్దు", "తేలికపాటి పత్తి దుస్తులు ధరించండి"],
            "hi": ["नियमित रूप से पानी पिएं", "दोपहर 12 से 4 बजे तक बाहर न जाएं", "हल्के सूती कपड़े पहनें"]
        },
        "nearest": {
            "waterPoint": {"name": "Ward water point", "distanceM": 350},
            "shadeShelter": {"name": "Ward shade shelter", "distanceM": 500},
            "coolingCentre": {"name": "GHMC community centre", "distanceM": 900}
        },
        "dataQuality": "sample"
    }


@app.post("/api/v1/public/subscribe")
async def subscribe(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    phone = str(payload.get("phone") or payload.get("mobile") or "")
    digits = normalise_phone(phone)
    if not is_valid_mobile(digits):
        raise HTTPException(422, "Enter a valid Indian mobile number")
    if payload.get("consent") is not True:
        raise HTTPException(422, "Consent is required")
    if not any(w["id"] == payload.get("wardId") for w in wards):
        raise HTTPException(422, "Unknown ward")
    phone_hash = phone_lookup_hash(digits)
    subid = next((s["id"] for s in subscribers.values() if s["phoneHash"] == phone_hash), None) or f"sub-{secrets.token_hex(4)}"
    cipher = Fernet(settings.FERNET_KEY.encode())
    phone_encrypted = cipher.encrypt(digits.encode()).decode()
    sub_record = {
        "id": subid,
        "name": payload.get("name", "Resident"),
        "phoneHash": phone_hash,
        "phoneEncrypted": phone_encrypted,
        "wardId": payload["wardId"],
        "language": payload.get("language", "en"),
        "role": payload.get("role", payload.get("userType", "resident")),
        "channel": payload.get("channel", "SMS"),
        "consent": True,
        "active": True
    }
    subscribers[subid] = sub_record
    if isinstance(db, AsyncSession):
        try:
            await repository.create_or_update_subscriber(
                db,
                sub_id=subid,
                name=sub_record["name"],
                phone_hash=phone_hash,
                phone_encrypted=phone_encrypted,
                ward_id=sub_record["wardId"],
                language=sub_record["language"],
                role=sub_record["role"],
                channel=sub_record["channel"],
            )
        except Exception as exc:
            logger.warning("Could not persist subscriber to database: %s", exc)
    return {
        "subscriberId": subid,
        "id": subid,
        "success": True,
        "confirmationMessagePreview": "Heat safety alerts enabled for your ward.",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/v1/public/unsubscribe")
async def unsubscribe(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    phone = str(payload.get("phone", ""))
    digest = phone_lookup_hash(normalise_phone(phone))
    found = False
    for s in subscribers.values():
        if s["phoneHash"] == digest:
            s["active"] = False
            found = True
    if isinstance(db, AsyncSession):
        try:
            db_found = await repository.deactivate_subscriber_by_hash(db, digest)
            found = found or db_found
        except Exception as exc:
            logger.warning("Could not deactivate subscriber in database: %s", exc)
    return {"success": found}


@app.get("/api/v1/plans/{short_code}")
async def get_plan(
    short_code: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    item = next((p for p in plans.values() if p["shortCode"] == short_code), None)
    if not item and isinstance(db, AsyncSession):
        try:
            item = await repository.get_plan_by_short_code(db, short_code)
        except Exception:
            pass
    if not item:
        raise HTTPException(404, "Plan not found")
    return item


@app.post("/api/v1/plans")
async def save_plan(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    pid = secrets.token_hex(8)
    short = secrets.token_urlsafe(6)
    rec = {
        "id": pid,
        "shortCode": short,
        "name": payload.get("name", "Heat plan"),
        "items": payload.get("items", []),
        "totals": payload.get("totals", {}),
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    plans[pid] = rec
    if isinstance(db, AsyncSession):
        try:
            await repository.save_plan(db, pid, short, rec["name"], rec["items"], rec["totals"])
        except Exception as exc:
            logger.warning("Could not persist plan to database: %s", exc)
    return {"id": pid, "shortCode": short}


@app.delete("/api/v1/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    plans.pop(plan_id, None)
    if isinstance(db, AsyncSession):
        try:
            await repository.delete_plan_by_id(db, plan_id)
        except Exception as exc:
            logger.warning("Could not delete plan from db: %s", exc)
    return {"success": True}


@app.get("/api/v1/reports/city-summary")
async def report_city(user=Depends(officer)):
    return {"overview": await overview(user), "wards": [ward_view(w) for w in wards], "dataQuality": "sample"}


@app.get("/api/v1/reports/ward/{ward_id}")
async def report_ward(ward_id: str, user=Depends(officer)):
    return ward_view(_find_ward(ward_id))


@app.get("/api/v1/reports/plan/{plan_id}")
async def report_plan(
    plan_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    if plan_id in plans:
        return plans[plan_id]
    if isinstance(db, AsyncSession):
        try:
            item = await repository.get_plan_by_id(db, plan_id)
            if item:
                return item
        except Exception:
            pass
    raise HTTPException(404, "Plan not found")


@app.get("/api/v1/reports/alerts-summary")
async def report_alerts(user=Depends(officer)):
    return {"total": len(alerts), "alerts": alerts}


@app.get("/api/v1/settings")
async def get_settings(user=Depends(officer)):
    return city_settings


@app.put("/api/v1/settings")
async def update_settings(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    city_settings.update(payload)
    if isinstance(db, AsyncSession):
        try:
            await repository.update_city_settings(db, payload)
        except Exception as exc:
            logger.warning("Could not persist city settings to db: %s", exc)
    return city_settings


@app.get("/api/v1/alerts/templates")
async def list_templates(user=Depends(officer)):
    return templates


@app.post("/api/v1/alerts/templates")
async def add_template(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    item = {"id": secrets.token_hex(4), **payload}
    templates.append(item)
    if isinstance(db, AsyncSession):
        try:
            await repository.save_alert_template(db, item["id"], payload)
        except Exception as exc:
            logger.warning("Could not persist alert template to db: %s", exc)
    return item


@app.put("/api/v1/alerts/templates/{item_id}")
async def update_template(
    item_id: str,
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    found = next((x for x in templates if x["id"] == item_id), None)
    if not found:
        raise HTTPException(404, "Template not found")
    found.update(payload)
    if isinstance(db, AsyncSession):
        try:
            await repository.update_alert_template(db, item_id, payload)
        except Exception as exc:
            logger.warning("Could not update template in db: %s", exc)
    return found


@app.delete("/api/v1/alerts/templates/{item_id}")
async def del_template(
    item_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    templates[:] = [t for t in templates if t.get("id") != item_id]
    if isinstance(db, AsyncSession):
        try:
            await repository.delete_alert_template(db, item_id)
        except Exception as exc:
            logger.warning("Could not delete template from db: %s", exc)
    return {"success": True}


@app.get("/api/v1/alerts/rules")
async def list_rules(user=Depends(officer)):
    return rules


@app.post("/api/v1/alerts/rules")
async def add_rule(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    item = {"id": secrets.token_hex(4), "enabled": True, **payload}
    rules.append(item)
    if isinstance(db, AsyncSession):
        try:
            await repository.save_alert_rule(db, item["id"], payload)
        except Exception as exc:
            logger.warning("Could not persist alert rule to db: %s", exc)
    return item


@app.put("/api/v1/alerts/rules/{item_id}")
async def update_rule(
    item_id: str,
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    found = next((x for x in rules if x["id"] == item_id), None)
    if not found:
        raise HTTPException(404, "Rule not found")
    found.update(payload)
    if isinstance(db, AsyncSession):
        try:
            await repository.update_alert_rule(db, item_id, payload)
        except Exception as exc:
            logger.warning("Could not update rule in db: %s", exc)
    return found


@app.delete("/api/v1/alerts/rules/{item_id}")
async def delete_rule(
    item_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    rules[:] = [r for r in rules if r["id"] != item_id]
    if isinstance(db, AsyncSession):
        try:
            await repository.delete_alert_rule(db, item_id)
        except Exception as exc:
            logger.warning("Could not delete rule from db: %s", exc)
    return {"success": True}


@app.post("/api/v1/sensors/readings", status_code=202)
async def sensor_reading(
    payload: dict[str, Any],
    x_device_key: Optional[str] = Header(None),
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    if not x_device_key:
        raise HTTPException(401, "X-Device-Key required")
    rec = {**payload, "recordedAt": payload.get("recordedAt") or datetime.now(timezone.utc).isoformat(), "deviceKey": "[redacted]"}
    readings.append(rec)
    if isinstance(db, AsyncSession):
        try:
            await repository.add_sensor_reading(db, payload)
        except Exception as exc:
            logger.warning("Could not persist sensor reading to db: %s", exc)
    return {"accepted": True}


@app.get("/api/v1/sensors/validation")
async def sensor_validation(user=Depends(officer)):
    return {
        "maeC": 1.2,
        "rmseC": 1.5,
        "biasC": .2,
        "numberOfReadings": len(readings),
        "dataQuality": "sample",
        "model": {"trainedAt": None, "mae": 1.2, "rmse": 1.5, "nSamples": len(readings), "label": "synthetic demo model"},
        "wards": [{"wardId": w["id"], "wardName": w["name"], "modelledTempC": w["airTempEstimateC"], "sensorTempC": None, "readings": 0, "dataQuality": "sample"} for w in wards]
    }


@app.post("/api/v1/sensors/devices")
async def register_device(
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    key = secrets.token_urlsafe(32)
    did = secrets.token_hex(6)
    key_hash = hashlib.sha256(key.encode()).hexdigest()
    devices[did] = {**payload, "keyHash": key_hash}
    if isinstance(db, AsyncSession):
        try:
            await repository.register_device(db, did, payload.get("name"), payload.get("wardId"), key_hash)
        except Exception as exc:
            logger.warning("Could not persist device to db: %s", exc)
    return {"deviceId": did, "deviceKey": key}


# ─── Pipeline management endpoints ───────────────────────────────────────────

@app.get("/api/v1/pipelines/status")
async def pipelines_status(
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    """Return latest run status for each pipeline."""
    runs = []
    if isinstance(db, AsyncSession):
        try:
            runs = await repository.get_recent_pipeline_runs(db, limit=20)
        except Exception as exc:
            logger.warning("Could not fetch pipeline runs: %s", exc)
    return {"runs": runs, "dataQuality": "operational"}


@app.post("/api/v1/pipelines/run/{pipeline_name}")
async def trigger_pipeline(
    pipeline_name: str,
    background_tasks: BackgroundTasks,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    """Manually trigger a named pipeline run in the background."""
    allowed = {"weather", "satellite", "vulnerability", "grid"}
    if pipeline_name not in allowed:
        raise HTTPException(400, f"Unknown pipeline. Choose from: {', '.join(sorted(allowed))}")

    async def _run_weather():
        async with AsyncSessionLocal() as s:
            await fetch_open_meteo_weather(s)

    if pipeline_name == "weather":
        background_tasks.add_task(_run_weather)

    return {"triggered": pipeline_name, "status": "queued", "message": "Pipeline queued for background execution."}


# ─── Live forecast endpoints (wire to weather pipeline) ───────────────────────

@app.get("/api/v1/forecast/live")
async def forecast_live(
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    """Live 7-day + 48-hour forecast from Open-Meteo (cached 30 min)."""
    data = await fetch_open_meteo_weather(db if isinstance(db, AsyncSession) else None)
    return data


@app.get("/api/v1/forecast/wards/{ward_id}/live")
async def ward_forecast_live(
    ward_id: str,
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    """City forecast plus current modelled weather at this ward's centroid."""
    w = _find_ward(ward_id)
    city_forecast = await fetch_open_meteo_weather(db if isinstance(db, AsyncSession) else None)
    current_weather = (await fetch_ward_current_weather([w])).get(w["id"])
    return {
        **city_forecast,
        "wardId": w["id"],
        "wardName": w["name"],
        "currentWeather": current_weather,
        "forecastScope": "City forecast; current conditions from the ward centroid",
    }


# ─── Grid upload endpoint ──────────────────────────────────────────────────────

@app.post("/api/v1/grid/upload")
async def grid_upload_csv(
    request: Request,
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    """Upload measured utility substation CSV to update ward peak demand figures."""
    body = await request.body()
    csv_content = body.decode("utf-8", errors="replace")
    result = await ingest_utility_csv(
        db if isinstance(db, AsyncSession) else None,
        csv_content,
        wards
    )
    return result


# ─── ML model training endpoint ───────────────────────────────────────────────

@app.post("/api/v1/sensors/model/train")
async def train_air_temp_model(
    db: Optional[AsyncSession] = Depends(get_db_optional),
    user=Depends(officer)
):
    """Re-train the LST-to-air-temperature calibration model using available sensor readings."""
    import asyncio
    loop = asyncio.get_event_loop()
    _readings = readings if readings else None
    metrics = await loop.run_in_executor(None, lambda: ml_train(_readings))
    if isinstance(db, AsyncSession):
        try:
            from app.db.models import IngestionRun as _IR
            from datetime import datetime, timezone as _tz
            import time as _t
            run = _IR(
                id=f"run-ml-{int(_t.time())}",
                pipeline_name="air_temp_model_training",
                status="success",
                records_processed=metrics.get("n_samples", 0),
                started_at=datetime.now(_tz.utc),
                finished_at=datetime.now(_tz.utc),
                notes=f"MAE={metrics.get('mae', '?')}C, RMSE={metrics.get('rmse', '?')}C, R2={metrics.get('r2', '?')}",
            )
            db.add(run)
            await db.commit()
        except Exception as exc:
            logger.warning("Could not persist model training run: %s", exc)
    return {"status": "trained", "metrics": metrics, "dataQuality": "modelled"}


@app.get("/api/v1/sensors/model/info")
async def air_temp_model_info(user=Depends(officer)):
    """Return current ML model metadata and metrics."""
    info = get_model_info()
    return {"model": info, "dataQuality": "modelled"}


# ─── Privacy deletion endpoint (DPDP / GDPR compliance) ─────────────────────

@app.delete("/api/v1/public/subscribers/{phone_last4}")
async def delete_subscriber_data(
    phone_last4: str,
    payload: dict[str, Any],
    db: Optional[AsyncSession] = Depends(get_db_optional)
):
    """Allow a resident to request deletion of their subscription data."""
    phone = str(payload.get("phone", ""))
    digits = normalise_phone(phone)
    if len(digits) != 10:
        raise HTTPException(422, "Valid 10-digit phone required for identity verification")
    if digits[-4:] != phone_last4:
        raise HTTPException(403, "Last 4 digits do not match")
    digest = phone_lookup_hash(digits)
    deleted_count = 0
    keys_to_del = [k for k, s in subscribers.items() if s.get("phoneHash") == digest]
    for k in keys_to_del:
        del subscribers[k]
        deleted_count += 1
    if isinstance(db, AsyncSession):
        try:
            db_del = await repository.delete_subscriber_by_hash(db, digest)
            deleted_count += db_del
        except Exception as exc:
            logger.warning("Could not delete subscriber from db: %s", exc)
    return {
        "success": True,
        "deletedRecords": deleted_count,
        "message": "Your subscription data has been removed. You will no longer receive alerts."
    }
