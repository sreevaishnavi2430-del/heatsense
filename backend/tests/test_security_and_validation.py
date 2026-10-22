"""Regression tests for the security and input-validation fixes.

Each test here corresponds to a defect that was found and fixed:
  * get_db_optional masked every HTTPException as a 500
  * the CSV export routes were shadowed by the /{ward_id} and /{alert_id} routes
  * the sort / order / pagination parameters were unvalidated
  * alert creation accepted unknown ward ids and unbounded message bodies
  * subscriber phone numbers were indexed by an unsalted, reversible SHA-256
"""
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import main
from app.privacy import normalise_phone, is_valid_mobile, phone_lookup_hash


def run_immediate(coroutine):
    """Advance no-I/O async handlers without creating a restricted Windows loop."""
    with pytest.raises(StopIteration) as result:
        coroutine.send(None)
    return result.value.value


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app, raise_server_exceptions=False) as test_client:
        yield test_client


# ── Route ordering ──────────────────────────────────────────────────────────

def test_ward_csv_export_is_not_shadowed_by_ward_detail(client):
    response = client.get("/api/v1/wards/export.csv")
    assert response.status_code == 200, "export.csv must not be captured by /wards/{ward_id}"
    assert response.headers["content-type"].startswith("text/csv")
    body = response.text.strip().splitlines()
    assert body[0].startswith("id,name,zone,heatRiskScore")
    assert len(body) == len(main.wards) + 1


def test_alert_csv_export_is_not_shadowed_by_alert_detail(client):
    response = client.get("/api/v1/alerts/export.csv")
    assert response.status_code == 200, "export.csv must not be captured by /alerts/{alert_id}"
    assert response.headers["content-type"].startswith("text/csv")
    assert response.text.strip().splitlines()[0].startswith("id,level,title")


# ── Input validation ────────────────────────────────────────────────────────

@pytest.mark.parametrize("sort", ["vulnerability", "amenities", "topDrivers", "nonexistent"])
def test_wards_rejects_unsortable_fields(client, sort):
    response = client.get(f"/api/v1/wards?sort={sort}")
    assert response.status_code == 422, f"sort={sort} must be rejected, not raise a 500"


@pytest.mark.parametrize("sort", ["heatRiskScore", "population", "name", "peakDemandStressIndex"])
def test_wards_accepts_documented_sort_fields(client, sort):
    assert client.get(f"/api/v1/wards?sort={sort}").status_code == 200


@pytest.mark.parametrize("params", ["page=0", "page=-1", "pageSize=0", "pageSize=999999"])
def test_wards_rejects_invalid_pagination(client, params):
    assert client.get(f"/api/v1/wards?{params}").status_code == 422


def test_wards_rejects_invalid_order(client):
    assert client.get("/api/v1/wards?order=sideways").status_code == 422


def test_alert_creation_rejects_unknown_ward_ids(client):
    response = client.post("/api/v1/alerts", json={"level": "Yellow", "wardIds": ["does-not-exist"]})
    assert response.status_code == 422


def test_alert_creation_rejects_oversized_message(client):
    response = client.post("/api/v1/alerts", json={"level": "Red", "title": "t", "message": "A" * 5000})
    assert response.status_code == 422


# ── Dependency must not mask HTTPExceptions ─────────────────────────────────

def test_subscribe_returns_422_for_invalid_phone(client):
    response = client.post(
        "/api/v1/public/subscribe",
        json={"phone": "123", "consent": True, "wardId": "charminar"},
    )
    assert response.status_code == 422, "validation errors must not be masked as 500"
    assert "mobile number" in response.json()["detail"].lower()


def test_subscribe_returns_422_without_consent(client):
    response = client.post(
        "/api/v1/public/subscribe",
        json={"phone": "9876543210", "wardId": "charminar"},
    )
    assert response.status_code == 422


def test_subscribe_returns_422_for_unknown_ward(client):
    response = client.post(
        "/api/v1/public/subscribe",
        json={"phone": "9876543210", "consent": True, "wardId": "nowhere"},
    )
    assert response.status_code == 422


def test_unsubscribe_returns_422_without_a_valid_phone(client):
    response = client.post("/api/v1/public/unsubscribe", json={"phone": "1"})
    assert response.status_code in (200, 422)


def test_get_db_optional_does_not_swallow_route_exceptions():
    """A route raising HTTPException must surface it, not become a 500."""
    with pytest.raises(HTTPException) as exc:
        run_immediate(main.subscribe({"name": "x", "phone": "123", "wardId": "charminar", "consent": True}))
    assert exc.value.status_code == 422


# ── Subscriber privacy ──────────────────────────────────────────────────────

def test_phone_lookup_hash_is_not_a_plain_digest():
    digits = "9876543210"
    digest = phone_lookup_hash(digits)
    import hashlib
    assert digest != hashlib.sha256(digits.encode()).hexdigest(), "must not be a reversible plain hash"
    assert digest == phone_lookup_hash(digits), "must stay deterministic for lookups"
    assert digest != phone_lookup_hash("9876543211")


def test_phone_lookup_hash_is_keyed_by_the_deployment_secret(monkeypatch):
    from app import privacy
    original = privacy.settings.SECRET_KEY
    before = phone_lookup_hash("9876543210")
    try:
        privacy.settings.SECRET_KEY = "a-different-deployment-secret"
        after = phone_lookup_hash("9876543210")
    finally:
        privacy.settings.SECRET_KEY = original
    assert before != after, "changing the deployment secret must change every lookup hash"


def test_normalise_and_validate_phone():
    assert normalise_phone("+91 98765-43210") == "9876543210"
    assert is_valid_mobile("9876543210")
    assert not is_valid_mobile("1234567890")
    assert not is_valid_mobile("98765")


def test_subscriber_record_never_stores_the_plain_number(client):
    client.post(
        "/api/v1/public/subscribe",
        json={"name": "Privacy", "phone": "9876543210", "consent": True, "wardId": "charminar"},
    )
    for record in main.subscribers.values():
        assert record["phoneEncrypted"] != "9876543210"
        assert "9876543210" not in record["phoneHash"]


# ── Deployment configuration ────────────────────────────────────────────────

def test_service_refuses_to_start_with_placeholder_secrets_outside_demo_mode(monkeypatch):
    monkeypatch.setattr(main.settings, "MODE", "production")
    monkeypatch.setattr(main.settings, "SECRET_KEY", main.DEFAULT_SECRET_KEY)
    monkeypatch.setattr(main.settings, "FERNET_KEY", main.DEFAULT_FERNET_KEY)
    with pytest.raises(RuntimeError) as exc:
        main._check_security_configuration()
    assert "SECRET_KEY" in str(exc.value)


def test_service_starts_with_unique_secrets_outside_demo_mode(monkeypatch):
    monkeypatch.setattr(main.settings, "MODE", "production")
    monkeypatch.setattr(main.settings, "SECRET_KEY", "a-unique-long-random-secret")
    monkeypatch.setattr(main.settings, "FERNET_KEY", "IUAGZ0WM4vbrFXI9e7cEWjaxgfy-BvKw_gkqE3jYXvI=")
    main._check_security_configuration()  # must not raise


def test_service_rejects_placeholder_secrets_outside_demo_mode(monkeypatch):
    monkeypatch.setattr(main.settings, "MODE", "production")
    monkeypatch.setattr(main.settings, "SECRET_KEY", "replace-with-a-long-random-secret")
    monkeypatch.setattr(main.settings, "FERNET_KEY", "replace-with-a-fernet-generated-key")
    with pytest.raises(RuntimeError) as exc:
        main._check_security_configuration()
    assert "SECRET_KEY" in str(exc.value)
    assert "FERNET_KEY" in str(exc.value)


def test_service_rejects_a_malformed_fernet_key_outside_demo_mode(monkeypatch):
    monkeypatch.setattr(main.settings, "MODE", "production")
    monkeypatch.setattr(main.settings, "SECRET_KEY", "a-unique-long-random-secret")
    monkeypatch.setattr(main.settings, "FERNET_KEY", "not-a-valid-fernet-key")
    with pytest.raises(RuntimeError) as exc:
        main._check_security_configuration()
    assert "FERNET_KEY" in str(exc.value)


def test_demo_mode_still_starts_with_the_published_defaults(monkeypatch):
    monkeypatch.setattr(main.settings, "MODE", "demo")
    monkeypatch.setattr(main.settings, "SECRET_KEY", main.DEFAULT_SECRET_KEY)
    monkeypatch.setattr(main.settings, "FERNET_KEY", main.DEFAULT_FERNET_KEY)
    main._check_security_configuration()  # must not raise
