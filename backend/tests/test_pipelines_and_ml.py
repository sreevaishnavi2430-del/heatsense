"""Tests for pipeline utilities, ML model, and new API endpoints."""
import asyncio
import math
import types
import sys


# ─── Satellite pipeline tests ─────────────────────────────────────────────────

def test_satellite_lst_conversion():
    """Validate Landsat 8/9 DN -> LST Celsius conversion formula."""
    from app.pipelines.satellite import dn_to_lst_celsius
    # Known: DN=22000, result should be approx 22000 * 0.00341802 + 149.0 - 273.15
    expected = 22000 * 0.00341802 + 149.0 - 273.15
    result = dn_to_lst_celsius(22000)
    assert abs(result - expected) < 0.01, f"LST conversion wrong: {result} vs {expected}"


def test_satellite_ndvi():
    """Validate NDVI formula using canonical compute_ndvi function."""
    from app.pipelines.satellite import compute_ndvi
    # NDVI = (nir - red) / (nir + red)
    assert abs(compute_ndvi(0.5, 0.1) - 0.6666) < 0.001
    assert compute_ndvi(0.0, 0.0) == 0.0  # zero division guard


def test_ward_adjusted_forecast():
    """Validate microclimate offset direction in ward forecast."""
    from app.pipelines.weather import compute_ward_adjusted_forecast
    city_forecast = {
        "daily": [{"date": "2025-05-01", "maxTempC": 42.0, "minTempC": 30.0, "alertLevel": "Orange", "condition": "Hot"}],
        "hourly": [],
        "heatWave": True,
        "source": "test",
    }
    # High built-up (80%), low tree cover (5%) -> positive offset
    hot_ward = {"id": "w1", "name": "Dense Ward", "builtUpPercent": 80.0, "treeCoverPercent": 5.0}
    adj = compute_ward_adjusted_forecast(hot_ward, city_forecast)
    assert adj["microclimateOffsetC"] > 0, "Dense wards should be hotter"
    assert adj["daily"][0]["maxTempC"] > 42.0

    # Low built-up (20%), high tree cover (40%) -> negative offset
    green_ward = {"id": "w2", "name": "Green Ward", "builtUpPercent": 20.0, "treeCoverPercent": 40.0}
    adj2 = compute_ward_adjusted_forecast(green_ward, city_forecast)
    assert adj2["microclimateOffsetC"] < 0, "Green wards should be cooler"


def test_grid_profile_keys():
    """Validate grid profile calculation returns required keys."""
    from app.pipelines.grid import calculate_hourly_grid_profile
    sample_wards = [
        {"id": "w1", "zone": "Central", "hourlyDemandMW": [40.0] * 24, "hourlyTemp": [35.0] * 24, "transformerOverloadRisk": "Low"},
        {"id": "w2", "zone": "East", "hourlyDemandMW": [35.0] * 24, "hourlyTemp": [36.0] * 24, "transformerOverloadRisk": "High"},
    ]
    result = calculate_hourly_grid_profile(sample_wards)
    assert "totalDemandMW" in result
    assert "peakHour" in result
    assert "stressedSubstationsCount" in result
    assert result["stressedSubstationsCount"] == 1
    assert len(result["hourlyLabels"]) == 24


def test_ml_predict_returns_float():
    """ML model predict_air_temp returns a valid float."""
    from app.ml.air_temp_model import predict_air_temp, train_model
    # Ensure model is trained
    train_model()
    result = predict_air_temp(lst_c=45.0, ndvi=0.1, ndbi=0.3, hour=14, solar_rad=800.0)
    assert isinstance(result, float)
    assert 20.0 <= result <= 65.0, f"Implausible prediction: {result}"


def test_ml_train_returns_metrics():
    """ML training returns expected metric keys."""
    from app.ml.air_temp_model import train_model
    metrics = train_model()
    for key in ("mae", "rmse", "r2", "n_samples", "trained_at", "label"):
        assert key in metrics, f"Missing metric key: {key}"
    assert metrics["n_samples"] >= 100
    assert metrics["mae"] < 5.0, "MAE too high for synthetic data"


def test_alert_mock_provider():
    """Mock alert provider logs without sending real SMS."""
    import asyncio
    from app.alerts.providers import MockAlertProvider
    provider = MockAlertProvider()
    result = asyncio.run(provider.send("9876543210", "Test heat alert", "en"))
    assert result["status"] == "mock_sent"
    assert "****3210" in result["to"]
    assert len(provider.sent) == 1


def test_twilio_stub_guard():
    """TwilioProvider STUB_ONLY guard prevents accidental live sends."""
    from app.alerts.providers import TwilioProvider
    provider = TwilioProvider()
    result = asyncio.run(provider.send("9876543210", "Test"))
    assert result["status"] == "stub_only"
