"""Backend tests for photo upload + admin flat reset features."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
if not BASE_URL.startswith("http"):
    BASE_URL = "http://localhost:8001"

# Try to read from frontend .env
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
except Exception:
    pass

API = f"{BASE_URL}/api"

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="

ADMIN_CREDS = {"flat_number": "ADMIN", "password": "shivadmin2026"}


def _unique_plate(prefix="TS"):
    return f"{prefix}{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN_CREDS, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _signup_free_flat():
    """Try flats until one succeeds. Returns dict with token/user/flat/plate."""
    all_flats = [f"{floor}{unit:02d}" for floor in (5,4,3,2,1) for unit in range(1,13)]
    for flat in all_flats:
        plate = _unique_plate()
        r = requests.post(f"{API}/auth/signup", json={
            "flat_number": flat,
            "owner_name": "TEST Resident",
            "phone": "+91 98765 43210",
            "vehicle_number": plate,
            "password": "test1234",
            "confirm_password": "test1234",
        }, timeout=15)
        if r.status_code == 201:
            data = r.json()
            return {"token": data["token"], "user": data["user"], "flat": flat, "plate": plate}
    raise RuntimeError("No free flats available")


@pytest.fixture()
def resident():
    return _signup_free_flat()


class TestPhotoUpload:
    def test_create_vehicle_with_photo(self, resident):
        plate = _unique_plate("PH")
        r = requests.post(
            f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST Photo",
                "phone": "+91 98765 43210",
                "flat_number": resident["flat"],
                "vehicle_number": plate,
                "is_guest": True,
                "photo": TINY_PNG,
            },
            timeout=15,
        )
        assert r.status_code == 201, r.text
        assert r.json()["photo"] == TINY_PNG
        vid = r.json()["id"]

        # GET verify
        g = requests.get(f"{API}/vehicles/{vid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["photo"] == TINY_PNG

    def test_photo_too_large_rejected(self, resident):
        big = "data:image/png;base64," + ("A" * 700_100)
        r = requests.post(
            f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST",
                "phone": "+91 98765 43210",
                "flat_number": resident["flat"],
                "vehicle_number": _unique_plate("BG"),
                "is_guest": True,
                "photo": big,
            },
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_photo_bad_prefix_rejected(self, resident):
        r = requests.post(
            f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST",
                "phone": "+91 98765 43210",
                "flat_number": resident["flat"],
                "vehicle_number": _unique_plate("BP"),
                "is_guest": True,
                "photo": "notadataurl",
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_put_photo_empty_clears(self, resident):
        plate = _unique_plate("CL")
        c = requests.post(
            f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST",
                "phone": "+91 98765 43210",
                "flat_number": resident["flat"],
                "vehicle_number": plate,
                "is_guest": True,
                "photo": TINY_PNG,
            },
            timeout=15,
        )
        assert c.status_code == 201
        vid = c.json()["id"]

        u = requests.put(
            f"{API}/vehicles/{vid}",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={"photo": ""},
            timeout=15,
        )
        assert u.status_code == 200, u.text
        assert u.json()["photo"] is None


class TestAdminUsers:
    def test_list_users_requires_auth(self):
        r = requests.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 401

    def test_list_users_forbidden_for_non_admin(self, resident):
        r = requests.get(
            f"{API}/admin/users",
            headers={"Authorization": f"Bearer {resident['token']}"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_list_users_admin_ok(self, admin_token, resident):
        r = requests.get(
            f"{API}/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        # Admin excluded
        assert all(u["flat_number"] != "ADMIN" for u in users)
        # includes vehicle_count
        for u in users:
            assert "vehicle_count" in u
        # includes our fresh resident
        found = [u for u in users if u["flat_number"] == resident["flat"]]
        assert found, f"Fresh resident {resident['flat']} not in admin list"
        assert found[0]["vehicle_count"] >= 1

    def test_delete_user_removes_user_and_vehicles(self, admin_token, resident):
        # add extra vehicle for resident
        requests.post(
            f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST Extra",
                "phone": "+91 98765 43210",
                "flat_number": resident["flat"],
                "vehicle_number": _unique_plate("EX"),
                "is_guest": True,
            },
            timeout=15,
        )

        uid = resident["user"]["id"]
        d = requests.delete(
            f"{API}/admin/users/{uid}",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=15,
        )
        assert d.status_code == 204, d.text

        # Vehicles gone
        vs = requests.get(f"{API}/vehicles", timeout=15).json()
        assert not any(v.get("user_id") == uid for v in vs)

        # User can no longer login
        r = requests.post(f"{API}/auth/login", json={"flat_number": resident["flat"], "password": "test1234"}, timeout=15)
        assert r.status_code == 401

        # Flat can be re-registered
        plate2 = _unique_plate("NR")
        r2 = requests.post(f"{API}/auth/signup", json={
            "flat_number": resident["flat"],
            "owner_name": "TEST New Owner",
            "phone": "+91 98765 12345",
            "vehicle_number": plate2,
            "password": "test1234",
            "confirm_password": "test1234",
        }, timeout=15)
        assert r2.status_code == 201, r2.text

    def test_delete_admin_blocked(self, admin_token):
        # find admin user id via /auth/me
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15).json()
        r = requests.delete(f"{API}/admin/users/{me['id']}", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 400

    def test_delete_missing_user_404(self, admin_token):
        r = requests.delete(f"{API}/admin/users/does-not-exist-id", headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 404


class TestRegressions:
    def test_signup_login_flow(self):
        # sign up new flat
        used = {v["flat_number"] for v in requests.get(f"{API}/vehicles", timeout=15).json()}
        flat = None
        for f in [f"{floor}{unit:02d}" for floor in (1,2,3,4,5) for unit in range(1,13)]:
            if f not in used:
                flat = f; break
        plate = _unique_plate("RG")
        r = requests.post(f"{API}/auth/signup", json={
            "flat_number": flat, "owner_name": "TEST Reg", "phone": "+91 98765 00000",
            "vehicle_number": plate, "password": "test1234", "confirm_password": "test1234",
        }, timeout=15)
        assert r.status_code == 201
        # login
        l = requests.post(f"{API}/auth/login", json={"flat_number": flat, "password": "test1234"}, timeout=15)
        assert l.status_code == 200
        # cleanup
        admin = requests.post(f"{API}/auth/login", json=ADMIN_CREDS, timeout=15).json()["token"]
        requests.delete(f"{API}/admin/users/{r.json()['user']['id']}", headers={"Authorization": f"Bearer {admin}"}, timeout=15)

    def test_ownership_rule(self, resident):
        # create another user
        used = {v["flat_number"] for v in requests.get(f"{API}/vehicles", timeout=15).json()}
        flat = None
        for f in [f"{floor}{unit:02d}" for floor in (1,2,3,4,5) for unit in range(1,13)]:
            if f not in used and f != resident["flat"]:
                flat = f; break
        # try to add non-guest vehicle for a different flat with resident token
        r = requests.post(f"{API}/vehicles",
            headers={"Authorization": f"Bearer {resident['token']}"},
            json={
                "owner_name": "TEST Wrong",
                "phone": "+91 98765 43210",
                "flat_number": flat,
                "vehicle_number": _unique_plate("OW"),
                "is_guest": False,
            }, timeout=15)
        assert r.status_code == 403
