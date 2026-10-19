import pytest
from fastapi import HTTPException

from app import main


def run_immediate(coroutine):
    """Advance no-I/O async handlers without creating a restricted Windows loop."""
    with pytest.raises(StopIteration) as result:
        coroutine.send(None)
    return result.value.value


def test_risk_score_has_expected_formula_and_ranges():
    ward = main.wards[0]
    result = main.score_components(ward, {"wTemp": .35, "wTree": .20, "wBuilt": .15, "wVuln": .30})
    c = result["components"]
    expected = round(100 * (c["normTemp"] * .35 + c["normTreeCoverGap"] * .20 + c["normBuiltUp"] * .15 + c["vulnerabilityIndex"] * .30))
    assert result["score"] == expected
    assert 0 <= result["score"] <= 100


def test_planner_stays_within_budget_and_avoids_duplicate_types():
    body = main.PlannerBody(budgetInrLakh=30, types=["tree_planting", "water_points"], goal="maximise_people")
    result = run_immediate(main.planner(body, user={"sub": "test"}))
    assert result["totals"]["cost"] <= 30
    keys = [(item["wardId"], item["type"]) for item in result["items"]]
    assert len(keys) == len(set(keys))


def test_simulator_temperature_is_monotonic_with_more_trees():
    baseline = run_immediate(main.simulate(main.SimBody(wardId="charminar"), user={"sub": "test"}))
    cooled = run_immediate(main.simulate(main.SimBody(wardId="charminar", treeCoverIncreasePct=10), user={"sub": "test"}))
    assert cooled["after"]["tempC"] <= baseline["after"]["tempC"]
    assert cooled["disclaimer"]


def test_subscription_validation_and_encryption():
    payload = {"name": "Test", "phone": "9876543210", "wardId": "charminar", "language": "en", "consent": True}
    result = run_immediate(main.subscribe(payload))
    record = main.subscribers[result["subscriberId"]]
    assert record["phoneHash"]
    assert record["phoneEncrypted"] != "9876543210"
    assert "phone" not in result
    with pytest.raises(HTTPException) as exc:
        run_immediate(main.subscribe({**payload, "phone": "12345"}))
    assert exc.value.status_code == 422


def test_jwt_signature_and_expiry_validation():
    token = main._token("officer@heatsense.demo")
    assert main._decode_token(token)["sub"] == "officer@heatsense.demo"
    with pytest.raises(ValueError):
        main._decode_token(token + "tampered")
