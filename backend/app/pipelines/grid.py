"""Power grid demand modeling and measured utility CSV ingestion pipeline."""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IngestionRun

logger = logging.getLogger(__name__)


def calculate_hourly_grid_profile(wards: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate 24-hour aggregate citywide and zonal demand curves."""
    loads = [w.get("hourlyDemandMW", [40.0] * 24) for w in wards]
    total_demand = [round(sum(row[i] for row in loads), 1) for i in range(24)]
    temps = [round(sum(w.get("hourlyTemp", [35.0] * 24)[i] for w in wards) / max(1, len(wards)), 1) for i in range(24)]

    zones = ["Central", "East", "West", "North", "South"]
    zone_demand = {
        z: [round(sum(w.get("hourlyDemandMW", [40.0] * 24)[i] for w in wards if w.get("zone") == z), 1) for i in range(24)]
        for z in zones
    }

    peak_demand = max(total_demand) if total_demand else 0.0
    peak_hour_idx = total_demand.index(peak_demand) if total_demand else 14

    return {
        "hourlyLabels": [f"{i:02}:00" for i in range(24)],
        "totalDemandMW": total_demand,
        "temperatureCurveC": temps,
        "zoneDemand": zone_demand,
        "peakHour": f"{peak_hour_idx:02}:00",
        "peakDemandMW": peak_demand,
        "stressedSubstationsCount": sum(1 for w in wards if w.get("transformerOverloadRisk") == "High"),
        "dataQuality": "modelled",
        "calculatedAt": datetime.now(timezone.utc).isoformat(),
    }


async def ingest_utility_csv(
    session: Optional[AsyncSession],
    csv_content: str,
    wards: list[dict[str, Any]],
) -> dict[str, Any]:
    """Ingest measured substation utility data from CSV and update ward peak demand."""
    now = datetime.now(timezone.utc)
    started_at = now
    reader = csv.DictReader(io.StringIO(csv_content))
    updated_count = 0

    ward_map = {w["id"]: w for w in wards}
    ward_name_map = {w["name"].casefold(): w for w in wards}

    for row in reader:
        wid = row.get("wardId") or row.get("ward_id") or row.get("id")
        wname = (row.get("wardName") or row.get("ward_name") or "").casefold()
        target = ward_map.get(wid) or ward_name_map.get(wname)
        if target:
            if "peakPowerDemandMW" in row or "peak_demand_mw" in row or "demand_mw" in row:
                raw_val = row.get("peakPowerDemandMW") or row.get("peak_demand_mw") or row.get("demand_mw")
                try:
                    target["peakPowerDemandMW"] = float(raw_val)
                    updated_count += 1
                except (ValueError, TypeError):
                    pass
            if "transformerOverloadRisk" in row or "overload_risk" in row:
                risk = row.get("transformerOverloadRisk") or row.get("overload_risk")
                if risk in ("Low", "Medium", "High"):
                    target["transformerOverloadRisk"] = risk

    if session:
        run_record = IngestionRun(
            id=f"run-grid-{int(now.timestamp())}",
            pipeline_name="utility_power_import",
            status="success",
            records_processed=updated_count,
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            notes=f"Uploaded measured utility data. Updated peak power measurements for {updated_count} wards.",
        )
        session.add(run_record)
        await session.commit()

    return {
        "status": "success",
        "recordsIngested": updated_count,
        "ingestedAt": now.isoformat(),
        "dataQuality": "measured_utility",
    }
