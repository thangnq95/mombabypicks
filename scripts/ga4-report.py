#!/usr/bin/env python3
"""Fetch GA4 reports for MomBabyPicks using a service account JSON key.

No third-party Python packages are required. The script uses:
- stdlib HTTP requests
- OpenSSL CLI for RS256 signing

Default report:
- affiliate_click events grouped by pagePathPlusQueryString
- traffic-sources grouped by channel/source/page for separating real traffic from dev referrals

Examples:
  python3 scripts/ga4-report.py \
    --key secrets/mombabypicks-ga4-service-account.json \
    --property 542288344 \
    --days 7 \
    --limit 20 \
    --output pipeline/data/ga4/affiliate-clicks.json

Environment fallbacks:
  GA4_SERVICE_ACCOUNT_KEY
  GA4_PROPERTY_ID
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


TOKEN_URL = "https://oauth2.googleapis.com/token"
GA4_API_BASE = "https://analyticsdata.googleapis.com/v1beta"
SCOPE = "https://www.googleapis.com/auth/analytics.readonly"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _load_service_account(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError as exc:
        raise SystemExit(f"Service account key not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON key file: {path}") from exc


def _sign_rs256(message: bytes, private_key_pem: str) -> bytes:
    """Sign `message` using OpenSSL's RS256 implementation."""
    with tempfile.NamedTemporaryFile("w", delete=False) as tmp:
        tmp.write(private_key_pem)
        key_path = tmp.name
    try:
        proc = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=message,
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0:
            stderr = proc.stderr.decode("utf-8", "replace").strip()
            raise SystemExit(f"OpenSSL signing failed: {stderr}")
        return proc.stdout
    finally:
        try:
            os.unlink(key_path)
        except OSError:
            pass


def _fetch_json(url: str, method: str = "GET", headers: dict[str, str] | None = None, body: bytes | None = None) -> dict[str, Any]:
    req = Request(url, method=method, headers=headers or {}, data=body)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise SystemExit(f"HTTP {exc.code} from {url}: {detail}") from exc
    except URLError as exc:
        raise SystemExit(f"Network error calling {url}: {exc}") from exc


def _get_access_token(sa: dict[str, Any]) -> str:
    now = int(time.time())
    header = {"alg": "RS256", "typ": "JWT"}
    payload = {
        "iss": sa["client_email"],
        "scope": SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = f"{_b64url(json.dumps(header, separators=(',', ':')).encode())}.{_b64url(json.dumps(payload, separators=(',', ':')).encode())}".encode()
    signature = _sign_rs256(signing_input, sa["private_key"])
    jwt = f"{signing_input.decode()}.{_b64url(signature)}"

    form = (
        "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
        f"&assertion={jwt}"
    ).encode("utf-8")
    token = _fetch_json(
        TOKEN_URL,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=form,
    )
    access_token = token.get("access_token")
    if not access_token:
        raise SystemExit(f"Token response missing access_token: {token}")
    return access_token


def _ga4_report(access_token: str, property_id: str, report: str, days: int, limit: int) -> dict[str, Any]:
    url = f"{GA4_API_BASE}/properties/{property_id}:runReport"

    if report == "affiliate-clicks":
        body: dict[str, Any] = {
            "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "today"}],
            "dimensions": [{"name": "pagePathPlusQueryString"}],
            "metrics": [{"name": "eventCount"}],
            "dimensionFilter": {
                "filter": {
                    "fieldName": "eventName",
                    "stringFilter": {
                        "value": "affiliate_click",
                        "matchType": "EXACT",
                        "caseSensitive": False,
                    },
                }
            },
            "orderBys": [
                {"metric": {"metricName": "eventCount"}, "desc": True},
                {"dimension": {"dimensionName": "pagePathPlusQueryString"}},
            ],
            "limit": str(limit),
        }
    elif report == "overview":
        body = {
            "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "today"}],
            "dimensions": [{"name": "pagePathPlusQueryString"}],
            "metrics": [{"name": "screenPageViews"}, {"name": "sessions"}, {"name": "activeUsers"}],
            "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}],
            "limit": str(limit),
        }
    elif report == "traffic-sources":
        body = {
            "dateRanges": [{"startDate": f"{days}daysAgo", "endDate": "today"}],
            "dimensions": [
                {"name": "sessionDefaultChannelGroup"},
                {"name": "sessionSourceMedium"},
                {"name": "pagePathPlusQueryString"},
            ],
            "metrics": [{"name": "sessions"}, {"name": "screenPageViews"}],
            "orderBys": [
                {"metric": {"metricName": "sessions"}, "desc": True},
                {"metric": {"metricName": "screenPageViews"}, "desc": True},
            ],
            "limit": str(limit),
        }
    else:
        raise SystemExit(f"Unsupported report type: {report}")

    return _fetch_json(
        url,
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        body=json.dumps(body).encode("utf-8"),
    )


def _rows_to_dicts(report: dict[str, Any]) -> list[dict[str, Any]]:
    dim_headers = [d["name"] for d in report.get("dimensionHeaders", [])]
    metric_headers = [m["name"] for m in report.get("metricHeaders", [])]
    rows = []
    for row in report.get("rows", []):
        record: dict[str, Any] = {}
        for idx, value in enumerate(row.get("dimensionValues", [])):
            record[dim_headers[idx]] = value.get("value")
        for idx, value in enumerate(row.get("metricValues", [])):
            raw = value.get("value")
            try:
                record[metric_headers[idx]] = int(raw) if raw is not None and raw.isdigit() else float(raw)
            except Exception:
                record[metric_headers[idx]] = raw
        rows.append(record)
    return rows


def _print_human(report_type: str, report: dict[str, Any], days: int) -> None:
    rows = _rows_to_dicts(report)
    print(f"GA4 report: {report_type}")
    print(f"Date range: last {days} days")
    print(f"Rows: {len(rows)}")
    print("")

    if not rows:
        print("No rows returned.")
        return

    if report_type == "affiliate-clicks":
        print(f"{'Clicks':>8}  Page")
        print("-" * 72)
        for row in rows:
            clicks = row.get("eventCount", 0)
            page = row.get("pagePathPlusQueryString", "")
            print(f"{clicks:>8}  {page}")
    else:
        headers = list(rows[0].keys())
        print(" | ".join(headers))
        print("-" * 72)
        for row in rows:
            print(" | ".join(str(row.get(h, "")) for h in headers))


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch GA4 reports with a service account JSON key.")
    parser.add_argument("--key", default=os.environ.get("GA4_SERVICE_ACCOUNT_KEY"), help="Path to the GA4 service account JSON key.")
    parser.add_argument("--property", default=os.environ.get("GA4_PROPERTY_ID"), help="GA4 property ID, e.g. 542288344.")
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days.")
    parser.add_argument("--limit", type=int, default=20, help="Max rows to return.")
    parser.add_argument("--report", choices=["affiliate-clicks", "overview", "traffic-sources"], default="affiliate-clicks", help="Report type to fetch.")
    parser.add_argument("--output", help="Optional JSON output file path.")
    args = parser.parse_args()

    if not args.key:
        raise SystemExit("Missing --key or GA4_SERVICE_ACCOUNT_KEY")
    if not args.property:
        raise SystemExit("Missing --property or GA4_PROPERTY_ID")

    key_path = Path(os.path.expanduser(args.key)).resolve()
    sa = _load_service_account(key_path)
    access_token = _get_access_token(sa)
    report = _ga4_report(access_token, str(args.property), args.report, args.days, args.limit)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"Wrote report JSON to {out_path}")

    _print_human(args.report, report, args.days)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
