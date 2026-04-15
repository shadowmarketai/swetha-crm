#!/usr/bin/env python3
"""
Integration test for Voice Agent API endpoints.

Usage:
    python scripts/test_voice_agent.py [--base-url http://localhost:8000]

Tests:
    1. Health check
    2. List voices (empty)
    3. Add knowledge document
    4. List knowledge documents
    5. Delete knowledge document
    6. List recordings
    7. Get recording stats
"""

import argparse
import json
import logging
import sys
from urllib import request, error

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

PASS = "PASS"
FAIL = "FAIL"
results: list[tuple[str, str, str]] = []


def api(base: str, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    """Make an HTTP request and return (status_code, json_body)."""
    url = f"{base}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except error.HTTPError as e:
        return e.code, json.loads(e.read().decode()) if e.readable() else {}
    except Exception as e:
        return 0, {"error": str(e)}


def test(name: str, passed: bool, detail: str = ""):
    status = PASS if passed else FAIL
    results.append((name, status, detail))
    icon = "+" if passed else "x"
    log.info(f"  [{icon}] {name}" + (f" — {detail}" if detail else ""))


def run(base_url: str):
    log.info(f"\nVoice Agent Integration Tests")
    log.info(f"Base URL: {base_url}\n")

    # 1. Health check
    log.info("--- Health Check ---")
    code, body = api(base_url, "GET", "/api/v1/health")
    test("Health endpoint reachable", code == 200, f"status={code}")

    # 2. List voices (should be empty or return list)
    log.info("\n--- Voices ---")
    code, body = api(base_url, "GET", "/api/v1/agent/voices?tenant_id=test")
    test("List voices", code == 200, f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # 3. Add knowledge document
    log.info("\n--- Knowledge Base ---")
    doc_payload = {
        "title": "Integration Test Doc",
        "content": "This is a test document for integration testing of the voice agent knowledge base.",
        "doc_type": "document",
        "tenant_id": "test",
    }
    code, body = api(base_url, "POST", "/api/v1/agent/knowledge", doc_payload)
    test("Add knowledge document", code in (200, 201), f"status={code}")
    doc_id = None
    if isinstance(body, list) and len(body) > 0:
        doc_id = body[0].get("id")
        test("Document has ID", doc_id is not None, f"id={doc_id}")
    elif isinstance(body, dict) and body.get("id"):
        doc_id = body["id"]
        test("Document has ID", True, f"id={doc_id}")

    # 4. List knowledge documents
    code, body = api(base_url, "GET", "/api/v1/agent/knowledge?tenant_id=test")
    test("List knowledge docs", code == 200, f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # 5. Delete knowledge document (cleanup)
    if doc_id:
        code, body = api(base_url, "DELETE", f"/api/v1/agent/knowledge/{doc_id}")
        test("Delete knowledge doc", code in (200, 204), f"status={code}")

    # 6. List recordings
    log.info("\n--- Recordings ---")
    code, body = api(base_url, "GET", "/api/v1/agent/recordings?tenant_id=test")
    test("List recordings", code == 200, f"count={len(body) if isinstance(body, list) else 'N/A'}")

    # 7. Recording stats
    code, body = api(base_url, "GET", "/api/v1/agent/recordings/stats?tenant_id=test")
    test("Get recording stats", code == 200, f"status={code}")

    # Summary
    passed = sum(1 for _, s, _ in results if s == PASS)
    failed = sum(1 for _, s, _ in results if s == FAIL)
    log.info(f"\n{'='*40}")
    log.info(f"Results: {passed} passed, {failed} failed, {len(results)} total")
    log.info(f"{'='*40}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voice Agent Integration Tests")
    parser.add_argument("--base-url", default="http://localhost:8000", help="API base URL")
    args = parser.parse_args()
    sys.exit(run(args.base_url))
