"""Test setup for the API.

main.py reads its config and creates the database AT IMPORT TIME, so the
environment has to be in place before `import main` ever runs. Everything
goes through the `api` fixture below, which sets env vars, points DB_PATH
at a throwaway file, and only then imports. Tests never touch a real
database or a real token.
"""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

TOKEN = "test-admin-token-not-a-real-secret"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture(scope="session")
def api(tmp_path_factory):
    db = tmp_path_factory.mktemp("db") / "test.db"
    os.environ.update(
        ADMIN_TOKEN=TOKEN,
        DB_PATH=str(db),
        CONTACT_MAX_PER_HOUR="5",
        SMTP_HOST="",                      # never send mail from a test
    )
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import main
    return main


@pytest.fixture
def client(api):
    """A fresh client per test: empty tables, empty rate-limit memory."""
    with api.db() as conn:
        conn.execute("DELETE FROM projects")
        conn.execute("DELETE FROM messages")
    api._contact_hits.clear()
    return TestClient(api.app)


@pytest.fixture
def project():
    return {
        "title": "Cheat Code Scanner",
        "meta": "AUG 2026 · PYTHON",
        "body": "What it does.",
        "tools": ["Python", "SQL"],
        "tags": ["cli"],
        "url": "https://github.com/x/y",
    }
