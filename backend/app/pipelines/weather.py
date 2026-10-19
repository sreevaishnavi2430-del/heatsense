"""Open-Meteo weather ingestion pipeline for Hyderabad heat and diurnal profiles."""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import IngestionRun

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
HYDERABAD_LAT = 17.3850
HYDERABAD_LNG = 78.4867

# Cache storage
_cached_forecast: Optional[dict[str, Any]] = None
_cached_at: Optional[datetime] = None
CACHE_TTL = timedelta(minutes=30)
WARD_WEATHER_CACHE_TTL = timedelta(minutes=15)
_cached_ward_weather: Optional[dict[str, dict[str, Any]]] = None
_cached_ward_weather_at: Optional[datetime] = None


def _get_condition_and_alert(max_temp: float) -> tuple[str, str]:
    """NDMA / IMD India heat warning thresholds for plains."""
    if max_temp >= 45.0:
        return "Red", "Extreme Heatwave Emergency"
    elif max_temp >= 43.0:
        return "Orange", "Severe Heatwave Warning"
    elif max_temp >= 40.0:
        return "Yellow", "Heatwave Caution"
    elif max_temp >= 37.0:
        return "Green", "Hot & Sunny"
    return "Green", "Moderate"


async def fetch_open_meteo_weather(session: Optional[AsyncSession] = None) -> dict[str, Any]:
    """Fetch live 7-day and 48-hour weather forecast for Hyderabad from Open-Meteo."""
    global _cached_forecast, _cached_at

    now = datetime.now(timezone.utc)
    if _cached_forecast and _cached_at and (now - _cached_at) < CACHE_TTL:
        return _cached_forecast

    started_at = now
    params = {
        "latitude": HYDERABAD_LAT,
        "longitude": HYDERABAD_LNG,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code",
        "hourly": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,shortwave_radiation",
        "daily": "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            raw = resp.json()

        daily_times = raw.get("daily", {}).get("time", [])
        daily_maxs = raw.get("daily", {}).get("temperature_2m_max", [])
        daily_mins = raw.get("daily", {}).get("temperature_2m_min", [])

        daily = []
        for i, date_str in enumerate(daily_times):
            if i >= len(daily_maxs) or i >= len(daily_mins) or daily_maxs[i] is None or daily_mins[i] is None:
                continue
            mx = float(daily_maxs[i])
            mn = float(daily_mins[i])
            alert_level, condition = _get_condition_and_alert(mx)
            daily.append({
                "date": date_str,
                "maxTempC": round(mx, 1),
                "minTempC": round(mn, 1),
                "alertLevel": alert_level,
                "condition": condition,
            })

        hourly_times = raw.get("hourly", {}).get("time", [])[:48]
        hourly_temps = raw.get("hourly", {}).get("temperature_2m", [])[:48]
        hourly_app = raw.get("hourly", {}).get("apparent_temperature", [])[:48]
        hourly_rh = raw.get("hourly", {}).get("relative_humidity_2m", [])[:48]
        hourly_precip = raw.get("hourly", {}).get("precipitation", [])[:48]
        hourly_wind = raw.get("hourly", {}).get("wind_speed_10m", [])[:48]

        hourly = []
        for i, t_str in enumerate(hourly_times):
            hourly.append({
                "time": t_str,
                "tempC": round(float(hourly_temps[i]), 1) if i < len(hourly_temps) and hourly_temps[i] is not None else None,
                "apparentTempC": round(float(hourly_app[i]), 1) if i < len(hourly_app) and hourly_app[i] is not None else None,
                "humidity": round(float(hourly_rh[i]), 1) if i < len(hourly_rh) and hourly_rh[i] is not None else None,
                "precipitationMm": round(float(hourly_precip[i]), 1) if i < len(hourly_precip) and hourly_precip[i] is not None else None,
                "windSpeedKmh": round(float(hourly_wind[i]), 1) if i < len(hourly_wind) and hourly_wind[i] is not None else None,
                "source": "Open-Meteo forecast model",
            })

        max_in_forecast = max([d["maxTempC"] for d in daily], default=40.0)
        has_heatwave = max_in_forecast >= 40.0

        forecast_data = {
            "daily": daily,
            "hourly": hourly,
            "heatWave": has_heatwave,
            "source": "Open-Meteo weather forecast API",
            "fetchedAt": now.isoformat(),
            "dataQuality": "forecast_model",
            "current": raw.get("current", {}),
        }

        _cached_forecast = forecast_data
        _cached_at = now

        # Record in ingestion runs
        if session:
            run_record = IngestionRun(
                id=f"run-weather-{int(now.timestamp())}",
                pipeline_name="open_meteo_weather",
                status="success",
                records_processed=len(daily) + len(hourly),
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                notes=f"Fetched 7 daily and 48 hourly forecasts for Hyderabad ({HYDERABAD_LAT}, {HYDERABAD_LNG}). Peak: {max_in_forecast}°C",
            )
            session.add(run_record)
            await session.commit()

        return forecast_data

    except Exception as exc:
        logger.warning("Open-Meteo fetch failed or timed out: %s", exc)
        unavailable_data = {
            "daily": [], "hourly": [], "heatWave": None,
            "source": "Open-Meteo unavailable",
            "fetchedAt": None,
            "dataQuality": "unavailable",
            "error": "Live weather is temporarily unavailable. No synthetic values are being shown.",
        }

        if session:
            run_record = IngestionRun(
                id=f"run-weather-{int(now.timestamp())}",
                pipeline_name="open_meteo_weather",
                status="failed",
                records_processed=0,
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                notes=f"Live weather request failed: {exc}",
            )
            session.add(run_record)
            await session.commit()

        return unavailable_data


async def fetch_ward_current_weather(wards: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Fetch modelled current 2 m air conditions at ward centroids in one request.

    These are gridded weather-model values, not ward-level station observations.
    """
    global _cached_ward_weather, _cached_ward_weather_at
    now = datetime.now(timezone.utc)
    if not wards:
        return {}

    requested_ids = {w["id"] for w in wards}
    if _cached_ward_weather and _cached_ward_weather_at and now - _cached_ward_weather_at < WARD_WEATHER_CACHE_TTL:
        if requested_ids.issubset(_cached_ward_weather):
            return {ward_id: _cached_ward_weather[ward_id] for ward_id in requested_ids}
    missing = [w for w in wards if not _cached_ward_weather or w["id"] not in _cached_ward_weather]
    if _cached_ward_weather_at and now - _cached_ward_weather_at >= WARD_WEATHER_CACHE_TTL:
        missing = wards
        _cached_ward_weather = {}

    latitudes = [str(float(w.get("centroid", [HYDERABAD_LAT, HYDERABAD_LNG])[0])) for w in missing]
    longitudes = [str(float(w.get("centroid", [HYDERABAD_LAT, HYDERABAD_LNG])[1])) for w in missing]
    params = {
        "latitude": ",".join(latitudes),
        "longitude": ",".join(longitudes),
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code",
        "timezone": "Asia/Kolkata",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    locations = payload if isinstance(payload, list) else [payload]
    result: dict[str, dict[str, Any]] = {}
    for index, ward in enumerate(missing):
        if index >= len(locations):
            continue
        current = locations[index].get("current") or {}
        if current.get("temperature_2m") is None:
            continue
        result[ward["id"]] = {
            "temperatureC": current.get("temperature_2m"),
            "apparentTemperatureC": current.get("apparent_temperature"),
            "relativeHumidityPct": current.get("relative_humidity_2m"),
            "windSpeedKmh": current.get("wind_speed_10m"),
            "precipitationMm": current.get("precipitation"),
            "weatherCode": current.get("weather_code"),
            "observedAt": current.get("time"),
            "source": "Open-Meteo gridded weather model",
            "dataQuality": "modelled_current_weather",
        }
    _cached_ward_weather = {**(_cached_ward_weather or {}), **result}
    _cached_ward_weather_at = now
    return {ward_id: _cached_ward_weather[ward_id] for ward_id in requested_ids if ward_id in _cached_ward_weather}


def compute_ward_adjusted_forecast(ward: dict[str, Any], city_forecast: dict[str, Any]) -> dict[str, Any]:
    """Adjust citywide weather forecast for a specific ward based on urban heat island microclimate."""
    # Built-up density increases heat retention; tree cover dampens peak extremes
    built_up = ward.get("builtUpPercent", 60.0)
    tree_cover = ward.get("treeCoverPercent", 10.0)
    microclimate_offset = round((built_up - 50.0) * 0.03 - (tree_cover - 10.0) * 0.05, 1)

    adjusted_daily = []
    for d in city_forecast.get("daily", []):
        adjusted_daily.append({
            **d,
            "maxTempC": round(d["maxTempC"] + microclimate_offset, 1),
            "minTempC": round(d["minTempC"] + microclimate_offset * 0.5, 1),
        })

    return {
        **city_forecast,
        "wardId": ward.get("id"),
        "wardName": ward.get("name"),
        "microclimateOffsetC": microclimate_offset,
        "daily": adjusted_daily,
    }
