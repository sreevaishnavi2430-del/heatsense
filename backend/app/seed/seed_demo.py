"""Validate and seed the bundled, explicitly sampled Hyderabad demo fixtures."""
import argparse
import asyncio
import json
from pathlib import Path

from app.db.session import init_db, AsyncSessionLocal
from app.db.repository import seed_database


async def async_seed(reset: bool = False) -> dict[str, int]:
    await init_db()
    async with AsyncSessionLocal() as session:
        return await seed_database(session, reset=reset)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Reset existing database records and re-seed from fixtures.")
    args = parser.parse_args()

    root = Path(__file__).parent
    wards = json.loads((root / "mock_wards.json").read_text(encoding="utf-8"))
    alerts = json.loads((root / "mock_alerts.json").read_text(encoding="utf-8"))
    if len(wards) != 40:
        raise SystemExit(f"Expected 40 sample wards; found {len(wards)}")

    counts = asyncio.run(async_seed(reset=args.reset))
    print(f"Demo fixtures ready: {len(wards)} wards, {len(alerts)} historical alerts. All are sample data.")
    print(f"Database seeded successfully: {counts}")


if __name__ == "__main__":
    main()
