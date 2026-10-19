"""ML air-temperature calibration model for HeatSense.

Maps satellite-derived features [lst_c, ndvi, ndbi, hour_of_day, solar_rad_w_m2]
to estimated air temperature in Celsius using GradientBoostingRegressor.

Physics-inspired synthetic training formula:
    air_temp = lst_c * 0.68 + ndvi * (-5) + ndbi * 3 + solar_rad * 0.003 + noise
"""
from __future__ import annotations

import logging
import math
import os
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ─── Optional sklearn / joblib imports ────────────────────────────────────────
try:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn not available; falling back to linear formula for air-temp predictions.")

try:
    import joblib

    _JOBLIB_AVAILABLE = True
except ImportError:
    _JOBLIB_AVAILABLE = False
    logger.warning("joblib not available; model will not be persisted to disk.")

# ─── Paths ─────────────────────────────────────────────────────────────────────
_MODEL_DIR = Path(__file__).parent.parent.parent.parent / "model_artifacts"
_MODEL_PATH = _MODEL_DIR / "air_temp_model.joblib"

# ─── Module-level state ────────────────────────────────────────────────────────
_model = None  # trained sklearn model or None (fallback to linear)
_model_metrics: Optional[dict[str, Any]] = None

# Feature names for consistency
FEATURE_NAMES = ["lst_c", "ndvi", "ndbi", "hour_of_day", "solar_rad_w_m2"]
N_SYNTHETIC = 200


# ─── Data generation ──────────────────────────────────────────────────────────

def _generate_synthetic_data(n: int = N_SYNTHETIC, seed: int = 42) -> tuple[list[list[float]], list[float]]:
    """Generate physics-inspired synthetic training data.

    Features: [lst_c, ndvi, ndbi, hour_of_day, solar_rad_w_m2]
    Label: air_temp_c using the formula:
        air_temp = lst_c * 0.68 + ndvi * (-5) + ndbi * 3 + solar_rad * 0.003 + noise
    """
    rng = random.Random(seed)
    X: list[list[float]] = []
    y: list[float] = []

    for _ in range(n):
        lst_c = rng.uniform(35.0, 55.0)
        ndvi = rng.uniform(0.05, 0.5)
        ndbi = rng.uniform(-0.2, 0.6)
        hour = rng.randint(0, 23)
        solar_rad = rng.uniform(0.0, 900.0)
        noise = rng.gauss(0.0, 0.8)

        air_temp = lst_c * 0.68 + ndvi * (-5.0) + ndbi * 3.0 + solar_rad * 0.003 + noise
        X.append([lst_c, ndvi, ndbi, float(hour), solar_rad])
        y.append(air_temp)

    return X, y


# ─── Fallback linear predictor ────────────────────────────────────────────────

def _linear_predict(lst_c: float, ndvi: float, ndbi: float, hour: float, solar_rad: float) -> float:
    """Simple physics-inspired linear formula used when sklearn is unavailable."""
    return lst_c * 0.68 + ndvi * (-5.0) + ndbi * 3.0 + solar_rad * 0.003


# ─── Public API ───────────────────────────────────────────────────────────────

def train_model(readings: Optional[list[dict[str, Any]]] = None) -> dict[str, Any]:
    """Train GradientBoostingRegressor on synthetic + optional real readings.

    Args:
        readings: Optional list of real sensor reading dicts. Each dict may
                  contain keys: lst_c, ndvi, ndbi, hour_of_day, solar_rad_w_m2,
                  air_temp_c.

    Returns:
        Metrics dict with keys: mae, rmse, r2, mbe, n_samples, trained_at, label.
    """
    global _model, _model_metrics

    X_synth, y_synth = _generate_synthetic_data(N_SYNTHETIC)
    X_all = list(X_synth)
    y_all = list(y_synth)

    # Incorporate real readings if supplied and valid
    if readings:
        for r in readings:
            try:
                row = [
                    float(r["lst_c"]),
                    float(r["ndvi"]),
                    float(r["ndbi"]),
                    float(r.get("hour_of_day", 12)),
                    float(r.get("solar_rad_w_m2", 500.0)),
                ]
                target = float(r["air_temp_c"])
                X_all.append(row)
                y_all.append(target)
            except (KeyError, TypeError, ValueError):
                pass  # skip malformed readings

    n_samples = len(X_all)

    if not _SKLEARN_AVAILABLE:
        # Evaluate fallback on synthetic data
        preds = [_linear_predict(*x) for x in X_synth]
        residuals = [p - t for p, t in zip(preds, y_synth)]
        mae = sum(abs(r) for r in residuals) / len(residuals)
        rmse = math.sqrt(sum(r ** 2 for r in residuals) / len(residuals))
        mbe = sum(residuals) / len(residuals)
        r2 = 0.0  # not computed for linear
        label = "linear_fallback (no sklearn)"
        metrics = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
            "mbe": round(mbe, 4),
            "n_samples": n_samples,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "label": label,
        }
        _model = None
        _model_metrics = metrics
        return metrics

    # ── sklearn path ──
    # Reserve at least 20% for validation
    test_size = max(0.2, 1 - (N_SYNTHETIC / n_samples))
    test_size = min(test_size, 0.4)

    if n_samples < 10:
        # Too few samples; train on all, evaluate on training set
        X_train, X_test, y_train, y_test = X_all, X_all, y_all, y_all
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X_all, y_all, test_size=test_size, random_state=42
        )

    clf = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        random_state=42,
    )
    clf.fit(X_train, y_train)
    preds = clf.predict(X_test)

    residuals = [float(p - t) for p, t in zip(preds, y_test)]
    mae = float(mean_absolute_error(y_test, preds))
    rmse = float(math.sqrt(mean_squared_error(y_test, preds)))
    r2 = float(r2_score(y_test, preds))
    mbe = sum(residuals) / len(residuals)

    label = "GradientBoostingRegressor" if not readings else f"GradientBoostingRegressor (+{len(readings)} real)"

    metrics = {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "mbe": round(mbe, 4),
        "n_samples": n_samples,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "label": label,
    }

    _model = clf
    _model_metrics = metrics

    # Persist model
    if _JOBLIB_AVAILABLE:
        try:
            _MODEL_DIR.mkdir(parents=True, exist_ok=True)
            joblib.dump({"model": clf, "metrics": metrics}, _MODEL_PATH)
            logger.info("Air-temp model saved to %s (MAE=%.3f, R2=%.3f)", _MODEL_PATH, mae, r2)
        except Exception as exc:
            logger.warning("Could not persist model to disk: %s", exc)

    return metrics


def predict_air_temp(
    lst_c: float,
    ndvi: float,
    ndbi: float,
    hour: float,
    solar_rad: float,
) -> float:
    """Predict air temperature (°C) from satellite-derived features.

    Args:
        lst_c: Land Surface Temperature in Celsius.
        ndvi: Normalized Difference Vegetation Index (-1 to 1).
        ndbi: Normalized Difference Built-Up Index (-1 to 1).
        hour: Hour of day (0–23).
        solar_rad: Solar irradiance in W/m².

    Returns:
        Estimated air temperature in Celsius.
    """
    global _model
    features = [lst_c, ndvi, ndbi, float(hour), solar_rad]

    if _model is not None and _SKLEARN_AVAILABLE:
        try:
            result = float(_model.predict([features])[0])
            return result
        except Exception as exc:
            logger.warning("Model prediction failed, using linear fallback: %s", exc)

    return _linear_predict(*features)


def get_model_info() -> Optional[dict[str, Any]]:
    """Return current model metrics dict, or None if model has never been trained."""
    return _model_metrics


# ─── Auto-train on import ─────────────────────────────────────────────────────

def _try_load_persisted() -> bool:
    """Attempt to load a previously persisted model from disk. Returns True on success."""
    global _model, _model_metrics
    if not (_JOBLIB_AVAILABLE and _MODEL_PATH.exists()):
        return False
    try:
        artifact = joblib.load(_MODEL_PATH)
        _model = artifact.get("model")
        _model_metrics = artifact.get("metrics")
        logger.info("Loaded persisted air-temp model from %s", _MODEL_PATH)
        return True
    except Exception as exc:
        logger.warning("Could not load persisted model: %s", exc)
        return False


# Auto-train if no model available
if not _try_load_persisted():
    try:
        logger.info("No persisted air-temp model found; training on synthetic data...")
        train_model()
    except Exception as _exc:
        logger.error("Auto-training failed: %s", _exc)
