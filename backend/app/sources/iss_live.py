"""ISS Live Telemetry and Cabin Environment Adapter.

Section 4.3: Real-time and simulated telemetry for International Space Station (ISS)
environmental and life-support metrics:
- Cabin pressure (kPa), ppO2 (kPa), ppCO2 (mmHg), temperature (°C)
- Radiation dosimeter readings (µGy/h)
- Orbital telemetry (altitude, latitude, longitude, velocity)
- Conforms to SourceAdapter protocol with provenance tracking
"""

from __future__ import annotations

import asyncio
import datetime
import math
import logging
from typing import Any
import httpx

from backend.app.sources.base import (
    LicenseInfo,
    NormalizedRecord,
    ProvenanceClass,
    SourceHealth,
)

logger = logging.getLogger("astrocare.sources.iss_live")

# Public ISS coordinates endpoint
ISS_COORDS_URL = "http://api.open-notify.org/iss-now.json"

ISS_LICENSE = LicenseInfo(
    name="NASA Open Data / Public ISS Telemetry",
    url="https://www.nasa.gov/international-space-station/",
    attribution_text="Data based on NASA ISS environmental standards and public orbital telemetry.",
    commercial_ok=True,
)


class ISSLiveAdapter:
    def __init__(self, cache_ttl_s: float = 30.0, timeout_s: float = 6.0) -> None:
        self.id = "iss_live"
        self.provenance = ProvenanceClass.LIVE_PUBLIC_FEED
        self.license = ISS_LICENSE
        self.cache_ttl_s = cache_ttl_s
        self.timeout_s = timeout_s

        self._cached_records: list[NormalizedRecord] = []
        self._cache_time: datetime.datetime | None = None
        self._last_success: datetime.datetime | None = None
        self._last_error: str | None = None
        self._last_latency_ms: float | None = None
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
        )

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

        lat = 0.0
        lon = 0.0
        live_coords = False

        try:
            res = await self._client.get(ISS_COORDS_URL)
            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000.0
            self._last_latency_ms = round(latency_ms, 1)

            if res.status_code == 200:
                data = res.json()
                if data.get("message") == "success" and "iss_position" in data:
                    lat = float(data["iss_position"].get("latitude", 0.0))
                    lon = float(data["iss_position"].get("longitude", 0.0))
                    live_coords = True
                    self._last_success = now
                    self._status = "ok"
                    self._last_error = None
        except Exception as exc:
            logger.debug("ISS coordinates fetch error (falling back to orbital model): %s", exc)
            self._last_error = str(exc)
            self._status = "degraded"

        # If live coords failed, compute deterministic orbital position based on timestamp
        epoch_sec = now.timestamp()
        if not live_coords:
            # Approx 92.68 min orbit at 51.6° inclination
            orbit_period = 92.68 * 60.0
            phase = (epoch_sec % orbit_period) / orbit_period
            lat = round(51.6 * math.sin(2 * math.pi * phase), 4)
            lon = round(((epoch_sec * 360 / 86400) % 360) - 180, 4)

        # Build environmental and telemetry records
        records: list[NormalizedRecord] = []

        # 1. Orbital position
        records.append(
            NormalizedRecord(
                metric="iss_latitude",
                value=lat,
                unit="degrees",
                source_id=self.id,
                provenance=ProvenanceClass.LIVE_PUBLIC_FEED if live_coords else ProvenanceClass.SIMULATED,
                entity="iss_orbital",
            )
        )
        records.append(
            NormalizedRecord(
                metric="iss_longitude",
                value=lon,
                unit="degrees",
                source_id=self.id,
                provenance=ProvenanceClass.LIVE_PUBLIC_FEED if live_coords else ProvenanceClass.SIMULATED,
                entity="iss_orbital",
            )
        )
        records.append(
            NormalizedRecord(
                metric="iss_altitude",
                value=418.5,
                unit="km",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_orbital",
            )
        )
        records.append(
            NormalizedRecord(
                metric="iss_velocity",
                value=27580.0,
                unit="km/h",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_orbital",
            )
        )

        # 2. Cabin Life Support Systems (ECLSS) simulated nominal baseline telemetry
        # Cabin Total Pressure: nominal 101.3 kPa
        records.append(
            NormalizedRecord(
                metric="iss_cabin_pressure",
                value=101.28,
                unit="kPa",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_cabin",
                raw_ref={"nominal_range": "99.9 - 102.6 kPa"},
            )
        )
        # Oxygen partial pressure (ppO2): nominal 21.3 kPa
        records.append(
            NormalizedRecord(
                metric="iss_cabin_ppo2",
                value=21.25,
                unit="kPa",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_cabin",
                raw_ref={"nominal_range": "19.5 - 23.1 kPa"},
            )
        )
        # Carbon dioxide partial pressure (ppCO2): nominal 2.8 mmHg
        records.append(
            NormalizedRecord(
                metric="iss_cabin_ppco2",
                value=2.85,
                unit="mmHg",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_cabin",
                raw_ref={"limit": "< 4.0 mmHg"},
            )
        )
        # Temperature: nominal 22.4 °C
        records.append(
            NormalizedRecord(
                metric="iss_cabin_temp",
                value=22.4,
                unit="degC",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_cabin",
                raw_ref={"nominal_range": "18.3 - 26.7 degC"},
            )
        )
        # Relative humidity: nominal 46%
        records.append(
            NormalizedRecord(
                metric="iss_cabin_humidity",
                value=46.2,
                unit="%",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_cabin",
                raw_ref={"nominal_range": "25 - 70 %"},
            )
        )
        # Dosimeter dose rate: South Atlantic Anomaly (SAA) variation based on lat/lon
        is_saa = (-45.0 <= lat <= -15.0) and (-70.0 <= lon <= 10.0)
        base_dose = 85.0 if is_saa else 14.5
        records.append(
            NormalizedRecord(
                metric="iss_radiation_dose_rate",
                value=base_dose,
                unit="uGy/h",
                source_id=self.id,
                provenance=ProvenanceClass.SIMULATED,
                entity="iss_radiation",
                raw_ref={"in_saa": is_saa},
            )
        )

        self._cached_records = records
        self._cache_time = now
        return records
