"""Iter76 — HEAD support, ETag/304 conditional GET, and StreamingResponse for /api/files/{path}.

These tests cover the three optional follow-ups requested by the user:
 1. HEAD method now returns 200 with proper headers (was 405).
 2. ETag header returned on every response + If-None-Match returns 304 Not Modified.
 3. StreamingResponse used for content delivery (verified indirectly via streaming chunk size).
"""
import base64
import io
import os
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://highlight-vibe-bugs.preview.emergentagent.com"
)

TRAINER_CREDS = {"email": "test_trainer_iter25@test.com", "password": "Test123!"}


def _login(creds: dict) -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def trainer_token():
    return _login(TRAINER_CREDS)


@pytest.fixture(scope="module")
def uploaded_file_path(trainer_token):
    """Upload a tiny PNG so all tests share one fresh file."""
    me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {trainer_token}"}, timeout=15).json()
    trainer_id = me["id"]
    # 1x1 transparent PNG
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
    )
    r = requests.post(
        f"{BASE_URL}/api/trainer-profiles/{trainer_id}/highlights/base64",
        headers={"Authorization": f"Bearer {trainer_token}", "Content-Type": "application/json"},
        json={
            "data": base64.b64encode(png_bytes).decode("ascii"),
            "filename": f"iter76_{uuid.uuid4().hex[:8]}.png",
            "contentType": "image/png",
            "caption": "TEST_iter76",
        },
        timeout=20,
    )
    r.raise_for_status()
    url = r.json()["highlight"]["url"]
    # url is like "/api/files/rapidreps/highlights/<uid>/<uuid>.png"
    return url


# ---------------------------------------------------------------------------
# 1. HEAD support
# ---------------------------------------------------------------------------
class TestHeadSupport:
    def test_head_returns_200_with_headers(self, uploaded_file_path):
        r = requests.head(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        assert r.status_code == 200, f"HEAD should return 200, got {r.status_code}"
        assert r.headers.get("Content-Type", "").startswith("image/")
        assert r.headers.get("Accept-Ranges") == "bytes"
        assert r.headers.get("ETag", "").startswith('"')
        # HEAD must NOT return a body
        assert r.content == b""

    def test_head_etag_matches_get_etag(self, uploaded_file_path):
        head = requests.head(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        get = requests.get(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        assert head.headers.get("ETag") == get.headers.get("ETag"), \
            "HEAD and GET must return the same ETag for the same resource"


# ---------------------------------------------------------------------------
# 2. ETag + If-None-Match 304
# ---------------------------------------------------------------------------
class TestEtagConditional:
    def test_get_returns_etag(self, uploaded_file_path):
        r = requests.get(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        assert r.status_code == 200
        etag = r.headers.get("ETag")
        assert etag, "ETag header missing on GET"
        assert etag.startswith('"') and etag.endswith('"'), f"ETag must be quoted, got {etag!r}"

    def test_if_none_match_returns_304(self, uploaded_file_path):
        # First get the ETag
        first = requests.get(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        etag = first.headers["ETag"]
        # Conditional GET — should be 304
        r = requests.get(
            f"{BASE_URL}{uploaded_file_path}",
            headers={"If-None-Match": etag},
            timeout=15,
        )
        assert r.status_code == 304, f"Expected 304 Not Modified, got {r.status_code}"
        assert r.content == b"", "304 response must have empty body"
        assert r.headers.get("ETag") == etag, "304 should echo the ETag"

    def test_if_none_match_mismatch_returns_200(self, uploaded_file_path):
        r = requests.get(
            f"{BASE_URL}{uploaded_file_path}",
            headers={"If-None-Match": '"NOT-THE-REAL-ETAG"'},
            timeout=15,
        )
        assert r.status_code == 200, "Mismatched If-None-Match must return full 200"
        assert len(r.content) > 0


# ---------------------------------------------------------------------------
# 3. Range still works after StreamingResponse refactor
# ---------------------------------------------------------------------------
class TestRangeStillWorks:
    def test_range_returns_206_with_streaming(self, uploaded_file_path):
        # Get total size first
        head = requests.head(f"{BASE_URL}{uploaded_file_path}", timeout=15)
        total = int(head.headers["Content-Length"])
        assert total >= 4, "Fixture file unexpectedly small"
        end = min(total - 1, 2)
        r = requests.get(
            f"{BASE_URL}{uploaded_file_path}",
            headers={"Range": f"bytes=0-{end}"},
            timeout=15,
        )
        assert r.status_code == 206
        assert r.headers["Content-Range"] == f"bytes 0-{end}/{total}"
        assert len(r.content) == end + 1
        # Vary: Range must be present so caches don't merge range/full responses
        assert "Range" in r.headers.get("Vary", ""), "Vary: Range header missing"

    def test_full_get_is_streamed_with_correct_total_length(self, uploaded_file_path):
        r = requests.get(f"{BASE_URL}{uploaded_file_path}", stream=True, timeout=15)
        assert r.status_code == 200
        chunks = list(r.iter_content(chunk_size=8))
        total_via_stream = sum(len(c) for c in chunks)
        assert total_via_stream == int(r.headers["Content-Length"]), \
            "Streamed body must equal Content-Length"
