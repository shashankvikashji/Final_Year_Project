"""SmartWaste AI backend regression tests.

Covers: auth (login/register/me), public reports, role-scoped list,
report create with AI scoring, detail 403, patch status crew-only.
"""
import os
import io
import base64
import uuid
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://priority-map.preview.emergentagent.com"
API = f"{BASE_URL}/api"

CITIZEN = ("citizen@smartwaste.app", "waste1234")
NGO = ("ngo@smartwaste.app", "waste1234")
MUNI = ("muni@smartwaste.app", "waste1234")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _make_photo_b64():
    # A real, non-blank JPEG (colored gradient) - not a fresh photo but visual features.
    img = Image.new("RGB", (400, 300), color=(80, 60, 40))
    # add some contrast blocks
    for x in range(0, 400, 40):
        for y in range(0, 300, 40):
            img.paste(((x * 3) % 255, (y * 5) % 255, 128), (x, y, x + 30, y + 30))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ------------ Auth ------------
class TestAuth:
    def test_login_citizen(self):
        data = _login(*CITIZEN)
        assert "token" in data and data["user"]["role"] == "citizen"

    def test_login_ngo(self):
        data = _login(*NGO)
        assert data["user"]["role"] == "ngo"

    def test_login_muni(self):
        data = _login(*MUNI)
        assert data["user"]["role"] == "municipality"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": CITIZEN[0], "password": "wrongpass"}, timeout=15)
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_with_token(self):
        tok = _login(*CITIZEN)["token"]
        r = requests.get(f"{API}/auth/me", headers=_headers(tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == CITIZEN[0]

    def test_register_new_citizen(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST User", "email": email, "password": "abc12345", "role": "citizen"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "citizen"
        assert d["user"]["email"] == email

    def test_register_password_short(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "T", "email": f"t{uuid.uuid4().hex[:6]}@x.com", "password": "123", "role": "citizen"
        }, timeout=10)
        assert r.status_code == 400


# ------------ Public reports ------------
class TestPublicReports:
    def test_public_reports_no_auth(self):
        r = requests.get(f"{API}/public/reports", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # seed produces >=6 reports
        assert len(data) >= 1
        # photo_url excluded in list
        for d in data:
            assert "photo_url" not in d
            assert "priority" in d and d["priority"] in ("low", "medium", "high", "critical")
            assert "_id" not in d
            assert "id" in d


# ------------ Role scoped list ------------
class TestRoleScopedList:
    def test_citizen_sees_only_own(self):
        tok = _login(*CITIZEN)["token"]
        me = requests.get(f"{API}/auth/me", headers=_headers(tok)).json()
        r = requests.get(f"{API}/reports", headers=_headers(tok), timeout=10)
        assert r.status_code == 200
        for d in r.json():
            assert d["reporter_id"] == me["id"]

    def test_ngo_sees_all(self):
        tok = _login(*NGO)["token"]
        r = requests.get(f"{API}/reports", headers=_headers(tok), timeout=10)
        assert r.status_code == 200
        reporters = {d["reporter_id"] for d in r.json()}
        # In fresh state may only have seeded citizen reports, but role must not filter
        assert len(r.json()) >= 1

    def test_muni_sees_all(self):
        tok = _login(*MUNI)["token"]
        r = requests.get(f"{API}/reports", headers=_headers(tok), timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ------------ Create with AI scoring ------------
class TestCreateReport:
    def test_create_report_ai_scored(self):
        tok = _login(*CITIZEN)["token"]
        payload = {
            "photo_url": _make_photo_b64(),
            "lat": 40.72,
            "lng": -73.99,
            "description": "TEST_AI scoring - synthetic waste photo submitted by regression suite.",
        }
        r = requests.post(f"{API}/reports", json=payload, headers=_headers(tok), timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["priority"] in ("low", "medium", "high", "critical")
        assert data["status"] == "reported"
        assert data["reporter_name"]
        assert "id" in data and "ai_rationale" in data

    def test_create_report_missing_photo(self):
        tok = _login(*CITIZEN)["token"]
        r = requests.post(f"{API}/reports", json={
            "photo_url": "", "lat": 40.7, "lng": -74.0, "description": "no photo attempt here"
        }, headers=_headers(tok), timeout=15)
        assert r.status_code == 400


# ------------ Detail perms ------------
class TestDetailPerms:
    def test_citizen_403_on_other_report(self):
        # NGO creates a report via citizen; instead, use another citizen: fetch first report as ngo, then try as new citizen
        ngo_tok = _login(*NGO)["token"]
        reports = requests.get(f"{API}/reports", headers=_headers(ngo_tok)).json()
        assert reports, "no reports seeded"
        # Find a report NOT owned by new test citizen
        # register a fresh citizen
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        newc = requests.post(f"{API}/auth/register", json={
            "name": "TEST Other", "email": email, "password": "abc12345", "role": "citizen"
        }).json()
        other_tok = newc["token"]
        target = reports[0]["id"]
        r = requests.get(f"{API}/reports/{target}", headers=_headers(other_tok), timeout=10)
        assert r.status_code == 403

    def test_ngo_can_get_any(self):
        ngo_tok = _login(*NGO)["token"]
        reports = requests.get(f"{API}/reports", headers=_headers(ngo_tok)).json()
        r = requests.get(f"{API}/reports/{reports[0]['id']}", headers=_headers(ngo_tok), timeout=10)
        assert r.status_code == 200
        assert "photo_url" in r.json()


# ------------ Status update perms ------------
class TestStatusUpdate:
    def test_citizen_403_on_patch_status(self):
        cit = _login(*CITIZEN)
        tok = cit["token"]
        reports = requests.get(f"{API}/reports", headers=_headers(tok)).json()
        assert reports
        rid = reports[0]["id"]
        r = requests.patch(f"{API}/reports/{rid}/status", json={"status": "in-progress"},
                           headers=_headers(tok), timeout=10)
        assert r.status_code == 403

    def test_ngo_can_patch_and_persist(self):
        ngo_tok = _login(*NGO)["token"]
        reports = requests.get(f"{API}/reports", headers=_headers(ngo_tok)).json()
        # pick one in reported status if possible
        target = next((r for r in reports if r["status"] == "reported"), reports[0])
        rid = target["id"]
        r = requests.patch(f"{API}/reports/{rid}/status", json={"status": "in-progress"},
                           headers=_headers(ngo_tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "in-progress"
        # verify persistence
        got = requests.get(f"{API}/reports/{rid}", headers=_headers(ngo_tok)).json()
        assert got["status"] == "in-progress"

    def test_muni_can_set_resolved(self):
        muni_tok = _login(*MUNI)["token"]
        reports = requests.get(f"{API}/reports", headers=_headers(muni_tok)).json()
        rid = reports[0]["id"]
        r = requests.patch(f"{API}/reports/{rid}/status", json={"status": "resolved"},
                           headers=_headers(muni_tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"
