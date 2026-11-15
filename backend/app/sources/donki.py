"""NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information) Adapter.

Section 4.2: Ingests real-time solar space weather notifications and events from NASA DONKI.
Includes:
- Notifications, Coronal Mass Ejections (CME), and Solar Flares (FLR)
- In-memory TTL caching (300s default)
- Handles NASA API key from config with DEMO_KEY fallback
- Normalizes records with provenance tracking
- Conforms to SourceAdapter protocol
"""

from __future__ import annotations

import asyncio
import datetime
import logging
from typing import Any
import httpx

from backend.app.core.config import settings
from backend.app.sources.base import (
    LicenseInfo,
    NormalizedRecord,
    ProvenanceClass,
    SourceHealth,
)

logger = logging.getLogger("astrocare.sources.donki")

DONKI_BASE_URL = "https://api.nasa.gov/DONKI"
DONKI_LICENSE = LicenseInfo(
    name="NASA Open Data Policy (U.S. Government Work)",
    url="https://api.nasa.gov/",
    attribution_text="Data provided by NASA Space Weather Database Of Notifications, Knowledge, Information (DONKI).",
    commercial_ok=True,
)


class NASADONKIAdapter:
    def __init__(self, cache_ttl_s: float = 300.0, timeout_s: float = 10.0) -> None:
        self.id = "nasa_donki"
        self.provenance = ProvenanceClass.LIVE_PUBLIC_FEED
        self.license = DONKI_LICENSE
        self.cache_ttl_s = cache_ttl_s
        self.timeout_s = timeout_s

        self._cached_records: list[NormalizedRecord] = []
        self._cached_events: list[dict[str, Any]] = []
        self._cache_time: datetime.datetime | None = None
        self._last_success: datetime.datetime | None = None
        self._last_error: str | None = None
        self._last_latency_ms: float | None = None
        self._rate_limit_remaining: int | None = None
        self._status: str = "ok"
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout_s)

    async def stop(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    def health(self) -> SourceHealth:
        now = datetime.datetime.now(datetime.timezone.utc)
        staleness = (now - self._last_success).total_seconds() if self._last_success else None
        return SourceHealth(
            source_id=self.id,
            status=self._status,
            last_success_at=self._last_success,
            last_error=self._last_error,
            staleness_s=staleness,
            latency_ms=self._last_latency_ms,
            rate_limit_remaining=self._rate_limit_remaining,
        )

    def _get_api_key(self) -> str:
        return getattr(settings, "NASA_API_KEY", None) or "DEMO_KEY"

    async def fetch_once(self, force_refresh: bool = False) -> list[NormalizedRecord]:
        now = datetime.datetime.now(datetime.timezone.utc)
        if (
            not force_refresh
            and self._cached_records
            and self._cache_time
            and (now - self._cache_time).total_seconds() < self.cache_ttl_s
        ):
            return self._cached_records

        if self._client is None or self._client.is_closed:
            await self.start()

        assert self._client is not None
        start_time = asyncio.get_event_loop().time()
        api_key = self._get_api_key()

        # Query recent 7 days
        start_date = (now - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")

        try:
            url = f"{DONKI_BASE_URL}/notifications"
            params = {
                "startDate": start_date,
                "endDate": end_date,
                "type": "all",
                "api_key": api_key,
            }
            res = await self._client.get(url, params=params)
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000.0
            self._last_latency_ms = round(latency_ms, 1)

            # Check rate limit headers
            rem = res.headers.get("X-RateLimit-Remaining")
            if rem and rem.isdigit():
                self._rate_limit_remaining = int(rem)

            if res.status_code != 200:
                raise RuntimeError(f"NASA DONKI API error HTTP {res.status_code}: {res.text[:200]}")

            items = res.json()
            if not isinstance(items, list):
                items = []

            records: list[NormalizedRecord] = []
            events_summary: list[dict[str, Any]] = []

            # Metric: Active space weather alert count
            records.append(
                NormalizedRecord(
                    metric="donki_recent_notification_count",
                    value=len(items),
                    unit="count",
                    source_id=self.id,
                    provenance=ProvenanceClass.LIVE_PUBLIC_FEED,
                    raw_ref={"startDate": start_date, "endDate": end_date},
                )
            )

            # Extract latest notifications
            for item in items[:15]:
                msg_id = item.get("messageID", "")
                msg_type = item.get("messageType", "")
                msg_time = item.get("messageIssueTime", "")
                msg_body = item.get("messageBody", "")
                events_summary.append({
                    "id": msg_id,
                    "type": msg_type,
                    "issue_time": msg_time,
                    "summary": msg_body[:280] if msg_body else "",
                })

            self._cached_events = events_summary
            self._cached_records = records
            self._cache_time = now
            self._last_success = now
            self._status = "ok"
            self._last_error = None
            return records

        except Exception as exc:
            logger.warning("NASA DONKI fetch failed, using fallback: %s", exc)
            self._last_error = str(exc)
            self._status = "degraded"
            if self._cached_records:
                return self._cached_records

            # Fallback simulated data
            sim_records = [
                NormalizedRecord(
                    metric="donki_recent_notification_count",
                    value=2,
                    unit="count",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                    raw_ref={"note": "fallback simulated notifications"},
                )
            ]
            self._cached_events = [
                {
                    "id": "SIM-2026-001",
                    "type": "CME",
                    "issue_time": now.isoformat(),
                    "summary": "Simulated Coronal Mass Ejection: Earth-directed flank expected in 48h.",
                },
                {
                    "id": "SIM-2026-002",
                    "type": "FLR",
                    "issue_time": now.isoformat(),
                    "summary": "Simulated Solar Flare: M1.4 flare observed in active region 3842.",
                },
            ]
            self._cached_records = sim_records
            self._cache_time = now
            return sim_records

    def get_cached_events(self) -> list[dict[str, Any]]:
        return self._cached_events
