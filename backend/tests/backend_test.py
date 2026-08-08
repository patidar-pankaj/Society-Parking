"""Backend API tests for Shiv Sampada Parking (auth + vehicles).

Tests share state via a module-scoped fixture. Uses random-picked fresh flats
from the valid set to avoid collisions across runs.
"""
import os
import random
import uuid
import pytest
import requests

with open('/app/frontend/.env') as _f:
    for _l in _f:
        if _l.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = _l.split('=', 1)[1].strip().rstrip('/')
            break

API = f"{BASE_URL}/api"

VALID_FLATS = [f"{fl}{u:02d}" for fl in range(1, 6) for u in range(1, 13)]


def _rand_plate(prefix="TST"):
    return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture(scope="module")
def ctx():
    """Login admin, pick fresh flats not yet registered, and sign up a primary user."""
    # Admin login (admin is auto-seeded on backend startup)
    r = requests.post(f"{API}/auth/login", json={"flat_number": "ADMIN", "password": "shivadmin2026"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["token"]
    assert r.json()["user"]["is_admin"] is True

    # Find fresh flats by trying signup
    def _fresh_signup(owner="Test"):
        candidates = random.sample(VALID_FLATS, len(VALID_FLATS))
        for flat in candidates:
            plate = _rand_plate()
            payload = {
                "flat_number": flat, "owner_name": owner, "phone": "+919000000000",
                "vehicle_number": plate, "password": "test1234", "confirm_password": "test1234",
            }
            r = requests.post(f"{API}/auth/signup", json=payload)
            if r.status_code == 201:
                return flat, plate, r.json()["token"], r.json()["user"]["id"]
            if r.status_code != 409:
                pytest.fail(f"Unexpected signup {r.status_code}: {r.text}")
        pytest.skip("No fresh flats available")

    flat_a, plate_a, token_a, uid_a = _fresh_signup("Primary")
    flat_b, plate_b, token_b, uid_b = _fresh_signup("Other")

    yield {
        "admin_token": admin_token,
        "flat_a": flat_a, "plate_a": plate_a, "token_a": token_a, "uid_a": uid_a,
        "flat_b": flat_b, "plate_b": plate_b, "token_b": token_b, "uid_b": uid_b,
    }


# ---------- Auth: Signup validation ----------
class TestSignupValidation:
    def test_signup_invalid_flat(self):
        for bad in ["113", "200", "613", "099"]:
            r = requests.post(f"{API}/auth/signup", json={
                "flat_number": bad, "owner_name": "X", "phone": "+919000000000",
                "vehicle_number": _rand_plate(), "password": "test1234", "confirm_password": "test1234"
            })
            assert r.status_code == 400, f"{bad} -> {r.status_code}"

    def test_signup_password_mismatch(self):
        r = requests.post(f"{API}/auth/signup", json={
            "flat_number": random.choice(VALID_FLATS), "owner_name": "X", "phone": "+919000000000",
            "vehicle_number": _rand_plate(), "password": "test1234", "confirm_password": "differ12"
        })
        assert r.status_code == 400

    def test_signup_duplicate_flat(self, ctx):
        r = requests.post(f"{API}/auth/signup", json={
            "flat_number": ctx["flat_a"], "owner_name": "Dup", "phone": "+919000000000",
            "vehicle_number": _rand_plate(), "password": "test1234", "confirm_password": "test1234"
        })
        assert r.status_code == 409

    def test_signup_duplicate_vehicle_variant(self, ctx):
        # spaces + lowercase variant of existing plate should still collide
        variant = " ".join(list(ctx["plate_a"].lower()))
        # pick a fresh flat to isolate
        for flat in random.sample(VALID_FLATS, len(VALID_FLATS)):
            r = requests.post(f"{API}/auth/signup", json={
                "flat_number": flat, "owner_name": "X", "phone": "+919000000000",
                "vehicle_number": variant, "password": "test1234", "confirm_password": "test1234"
            })
            if r.status_code == 409 and "vehicle" in r.text.lower():
                return
            # if the flat itself is taken (409 with "already registered") try another
            if r.status_code == 409 and "already registered" in r.text.lower() and "vehicle" not in r.text.lower():
                continue
            pytest.fail(f"Expected vehicle-dup 409, got {r.status_code}: {r.text}")


# ---------- Auth: Login / me ----------
class TestLoginMe:
    def test_login_wrong_password(self, ctx):
        r = requests.post(f"{API}/auth/login", json={"flat_number": ctx["flat_a"], "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_success(self, ctx):
        r = requests.post(f"{API}/auth/login", json={"flat_number": ctx["flat_a"], "password": "test1234"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, ctx):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {ctx['token_a']}"})
        assert r.status_code == 200
        assert r.json()["flat_number"] == ctx["flat_a"]

    def test_admin_is_admin(self, ctx):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {ctx['admin_token']}"})
        assert r.status_code == 200
        assert r.json()["is_admin"] is True

    def test_brute_force_lockout(self):
        # Use a random unused flat (does not need to exist — user check happens after lock)
        fake_flat = random.choice(VALID_FLATS)
        codes = []
        # Behind ingress requests hit multiple backend pods; each pod tracks its own counter.
        # We fire many attempts so at least one pod reaches the 5-fail threshold.
        for _ in range(20):
            r = requests.post(f"{API}/auth/login", json={"flat_number": fake_flat, "password": "wrongwrong"})
            codes.append(r.status_code)
        assert 429 in codes, f"Expected 429 lockout in {codes}"


# ---------- Vehicles ----------
class TestVehicles:
    def test_list_public_no_auth(self):
        r = requests.get(f"{API}/vehicles")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_search_partial(self, ctx):
        # user_a's plate should be findable via partial
        partial = ctx["plate_a"][3:7].lower()
        r = requests.get(f"{API}/vehicles", params={"search": partial})
        assert r.status_code == 200
        plates = [v["vehicle_number"] for v in r.json()]
        assert any(ctx["plate_a"].upper() == p.upper() for p in plates), plates

    def test_create_vehicle_no_auth(self, ctx):
        r = requests.post(f"{API}/vehicles", json={
            "owner_name": "X", "phone": "+919000000000", "flat_number": ctx["flat_a"],
            "vehicle_number": _rand_plate()
        })
        assert r.status_code == 401

    def test_create_vehicle_for_other_flat_forbidden(self, ctx):
        r = requests.post(f"{API}/vehicles",
            headers={"Authorization": f"Bearer {ctx['token_a']}"},
            json={"owner_name": "X", "phone": "+919000000000", "flat_number": ctx["flat_b"],
                  "vehicle_number": _rand_plate("F"), "is_guest": False})
        assert r.status_code == 403

    def test_create_guest_vehicle_allowed(self, ctx):
        plate = _rand_plate("GST")
        r = requests.post(f"{API}/vehicles",
            headers={"Authorization": f"Bearer {ctx['token_a']}"},
            json={"owner_name": "Guest", "phone": "+919000000000", "flat_number": ctx["flat_a"],
                  "vehicle_number": plate, "is_guest": True})
        assert r.status_code == 201, r.text
        assert r.json()["is_guest"] is True
        ctx["guest_vid"] = r.json()["id"]

    def test_update_own_vehicle(self, ctx):
        vid = ctx["guest_vid"]
        r = requests.put(f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {ctx['token_a']}"},
            json={"owner_name": "Guest Updated"})
        assert r.status_code == 200
        assert r.json()["owner_name"] == "Guest Updated"

    def test_update_others_vehicle_forbidden(self, ctx):
        vid = ctx["guest_vid"]
        r = requests.put(f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {ctx['token_b']}"},
            json={"owner_name": "hax"})
        assert r.status_code == 403

    def test_admin_can_update_any(self, ctx):
        vid = ctx["guest_vid"]
        r = requests.put(f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {ctx['admin_token']}"},
            json={"owner_name": "Admin Edited"})
        assert r.status_code == 200
        assert r.json()["owner_name"] == "Admin Edited"

    def test_delete_others_forbidden(self, ctx):
        vid = ctx["guest_vid"]
        r = requests.delete(f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {ctx['token_b']}"})
        assert r.status_code == 403

    def test_admin_can_delete(self, ctx):
        vid = ctx["guest_vid"]
        r = requests.delete(f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {ctx['admin_token']}"})
        assert r.status_code == 204
        r = requests.get(f"{API}/vehicles/{vid}")
        assert r.status_code == 404
