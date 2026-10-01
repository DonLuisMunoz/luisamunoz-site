"""Tests for api/main.py.

Run from api/:   uv run --group dev pytest
"""
import pytest

from conftest import AUTH, TOKEN


# ---------- auth: the highest-value tests here ----------

ADMIN_ROUTES = [
    ("post", "/api/projects"),
    ("put", "/api/projects/anything"),
    ("delete", "/api/projects/anything"),
    ("get", "/api/messages"),
]


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
@pytest.mark.parametrize("header", [
    None,                                   # missing
    {"Authorization": "Bearer wrong-token"},
    {"Authorization": TOKEN},               # no "Bearer " prefix
    {"Authorization": f"bearer {TOKEN}"},   # wrong case
    {"Authorization": f"Bearer {TOKEN} "},  # trailing space
    {"Authorization": "Bearer "},           # empty token
])
def test_admin_routes_reject_bad_auth(client, project, method, path, header):
    kwargs = {"headers": header or {}}
    if method in ("post", "put"):
        kwargs["json"] = project
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code == 401


def test_correct_token_is_accepted(client, project):
    assert client.post("/api/projects", json=project, headers=AUTH).status_code == 200
    assert client.get("/api/messages", headers=AUTH).status_code == 200


def test_reading_projects_and_health_stay_public(client):
    assert client.get("/api/projects").status_code == 200
    assert client.get("/api/health").json() == {"ok": True}


# ---------- CRUD ----------

def test_create_read_update_delete_round_trip(client, project):
    pid = client.post("/api/projects", json=project, headers=AUTH).json()["id"]
    assert pid == "cheat-code-scanner"

    listed = client.get("/api/projects").json()
    assert [p["id"] for p in listed] == [pid]
    assert listed[0]["title"] == "Cheat Code Scanner"

    edited = {**project, "title": "Cheat Code Scanner v2", "tags": ["cli", "tui"]}
    assert client.put(f"/api/projects/{pid}", json=edited, headers=AUTH).status_code == 200
    got = client.get("/api/projects").json()[0]
    assert got["title"] == "Cheat Code Scanner v2"
    assert got["tags"] == ["cli", "tui"]
    assert got["id"] == pid                  # editing the title doesn't move the URL

    assert client.delete(f"/api/projects/{pid}", headers=AUTH).status_code == 200
    assert client.get("/api/projects").json() == []


def test_tools_survive_a_round_trip(client, project):
    # `tools` was once missing from the schema. Reading projects from the API
    # instead of projects.json would have silently emptied the stack bars.
    client.post("/api/projects", json=project, headers=AUTH)
    assert client.get("/api/projects").json()[0]["tools"] == ["Python", "SQL"]


def test_duplicate_titles_get_distinct_ids(client, project):
    a = client.post("/api/projects", json=project, headers=AUTH).json()["id"]
    b = client.post("/api/projects", json=project, headers=AUTH).json()["id"]
    assert a != b and b.startswith(a + "-")
    assert len(client.get("/api/projects").json()) == 2


def test_editing_a_missing_project_is_404(client, project):
    r = client.put("/api/projects/does-not-exist", json=project, headers=AUTH)
    assert r.status_code == 404


def test_deleting_a_missing_project_is_404(client):
    # Was 200 {"ok": true} -- claiming success for something that wasn't there,
    # while PUT on the same id said 404. The two now agree.
    r = client.delete("/api/projects/does-not-exist", headers=AUTH)
    assert r.status_code == 404


# ---------- validation (Pydantic) ----------

@pytest.mark.parametrize("bad", [
    {"name": "Luis", "email": "not-an-email", "message": "hi"},
    {"name": "", "email": "a@b.com", "message": "hi"},
    {"name": "Luis", "email": "a@b.com", "message": ""},
    {"email": "a@b.com", "message": "hi"},
    {"name": "Luis", "email": "a@b.com", "message": "x" * 4001},
])
def test_contact_rejects_invalid_input(client, bad):
    assert client.post("/api/contact", json=bad).status_code == 422


def test_project_title_is_required_and_bounded(client, project):
    assert client.post("/api/projects", json={**project, "title": ""}, headers=AUTH).status_code == 422
    assert client.post("/api/projects", json={**project, "title": "x" * 121}, headers=AUTH).status_code == 422


def test_valid_contact_is_stored_and_readable_by_admin(client):
    msg = {"name": "Ada", "email": "ada@example.com", "message": "Hello there"}
    assert client.post("/api/contact", json=msg).status_code == 200
    inbox = client.get("/api/messages", headers=AUTH).json()
    assert [(m["name"], m["email"], m["message"]) for m in inbox] == [("Ada", "ada@example.com", "Hello there")]


# ---------- rate limiting ----------

MSG = {"name": "Bot", "email": "bot@example.com", "message": "spam"}


def test_sixth_message_in_an_hour_is_refused(client):
    for _ in range(5):
        assert client.post("/api/contact", json=MSG, headers={"CF-Connecting-IP": "1.2.3.4"}).status_code == 200
    r = client.post("/api/contact", json=MSG, headers={"CF-Connecting-IP": "1.2.3.4"})
    assert r.status_code == 429


def test_rate_limit_is_per_visitor_ip_not_per_socket(client):
    # Behind the Cloudflare tunnel every request arrives from Cloudflare's
    # address. If the limit keyed on the socket IP, five messages from ANY
    # visitors would lock out EVERYONE. It must key on CF-Connecting-IP.
    for _ in range(5):
        client.post("/api/contact", json=MSG, headers={"CF-Connecting-IP": "1.1.1.1"})
    assert client.post("/api/contact", json=MSG, headers={"CF-Connecting-IP": "1.1.1.1"}).status_code == 429
    assert client.post("/api/contact", json=MSG, headers={"CF-Connecting-IP": "2.2.2.2"}).status_code == 200


# ---------- injection ----------

@pytest.mark.parametrize("payload", [
    "'; DROP TABLE projects; --",
    "Robert'); DELETE FROM messages; --",
    "\" OR 1=1 --",
])
def test_sql_in_input_is_stored_as_plain_text(client, project, payload):
    # Parameterised queries (the ? placeholders) should make this boring.
    pid = client.post("/api/projects", json={**project, "title": payload, "body": payload}, headers=AUTH).json()["id"]
    rows = client.get("/api/projects").json()
    assert len(rows) == 1
    assert rows[0]["title"] == payload and rows[0]["body"] == payload
    client.post("/api/contact", json={"name": payload, "email": "x@example.com", "message": payload})
    assert client.get("/api/messages", headers=AUTH).json()[0]["message"] == payload
    # and the table is still there to delete from
    assert client.delete(f"/api/projects/{pid}", headers=AUTH).status_code == 200


# ---------- email ----------

def test_a_failing_mail_server_does_not_fail_the_request(client, api, monkeypatch):
    class Broken:
        def __init__(self, *a, **k):
            raise OSError("mail server unreachable")
    monkeypatch.setattr(api, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(api.smtplib, "SMTP", Broken)
    r = client.post("/api/contact", json={"name": "Ada", "email": "ada@example.com", "message": "hi"})
    assert r.status_code == 200
    assert len(client.get("/api/messages", headers=AUTH).json()) == 1   # stored anyway
