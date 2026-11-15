"""NOAA Space Weather Prediction Center (SWPC) Ingest Adapter.

Section 4.1: Real-time NOAA feeds for Kp index, GOES integral protons, and GOES X-rays.
Includes:
- Scales mapping: G1-G5 (geomagnetic), S1-S5 (solar radiation), R1-R5 (radio blackouts)
- In-memory TTL caching (60s default)
- Offline fallback with SIMULATED provenance tagging
- Conforms to SourceAdapter protocol
"""

from __future__ import annotations

import asyncio
import datetime
import logging
from typing import Any
import httpx

from backend.app.sources.base import (
    LicenseInfo,
    NormalizedRecord,
    ProvenanceClass,
    SourceHealth,
)

logger = logging.getLogger("astrocare.sources.noaa_swpc")

KP_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
PROTONS_URL = "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json"
XRAYS_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json"

NOAA_LICENSE = LicenseInfo(
    name="NOAA SWPC Open Data (U.S. Public Domain)",
    url="https://www.swpc.noaa.gov/content/data-access",
    attribution_text="Data provided by NOAA Space Weather Prediction Center, Boulder, CO, USA.",
    commercial_ok=True,
)


def compute_g_scale(kp: float) -> tuple[int, str]:
    """Map Kp index (0-9) to NOAA G-Scale (Geomagnetic Storms)."""
    if kp >= 9.0:
        return 5, "G5 (Extreme)"
    if kp >= 8.0:
        return 4, "G4 (Severe)"
    if kp >= 7.0:
        return 3, "G3 (Strong)"
    if kp >= 6.0:
        return 2, "G2 (Moderate)"
    if kp >= 5.0:
        return 1, "G1 (Minor)"
    return 0, "G0 (Quiet/Unsettled)"


def compute_s_scale(proton_flux_gt_10mev: float) -> tuple[int, str]:
    """Map GOES >10 MeV proton flux (pfu: particles/(cm2 s sr)) to NOAA S-Scale (Solar Radiation Storms)."""
    if proton_flux_gt_10mev >= 100000:
        return 5, "S5 (Extreme)"
    if proton_flux_gt_10mev >= 10000:
        return 4, "S4 (Severe)"
    if proton_flux_gt_10mev >= 1000:
        return 3, "S3 (Strong)"
    if proton_flux_gt_10mev >= 100:
        return 2, "S2 (Moderate)"
    if proton_flux_gt_10mev >= 10:
        return 1, "S1 (Minor)"
    return 0, "S0 (None)"


def compute_r_scale(xray_flux_long: float) -> tuple[int, str]:
    """Map GOES 0.1-0.8 nm X-ray flux (Watts/m2) to NOAA R-Scale (Radio Blackouts)."""
    if xray_flux_long >= 2.0e-3:
        return 5, "R5 (Extreme, >= X20)"
    if xray_flux_long >= 1.0e-3:
        return 4, "R4 (Severe, >= X10)"
    if xray_flux_long >= 1.0e-4:
        return 3, "R3 (Strong, >= X1)"
    if xray_flux_long >= 5.0e-5:
        return 2, "R2 (Moderate, >= M5)"
    if xray_flux_long >= 1.0e-5:
        return 1, "R1 (Minor, >= M1)"
    return 0, "R0 (None, < M1)"


class NOAASWPCAdapter:
    def __init__(self, cache_ttl_s: float = 60.0, timeout_s: float = 8.0) -> None:
        self.id = "noaa_swpc"
        self.provenance = ProvenanceClass.LIVE_PUBLIC_FEED
        self.license = NOAA_LICENSE
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

        try:
            # Parallel fetch of SWPC feeds
            kp_res, proton_res, xray_res = await asyncio.gather(
                self._client.get(KP_URL),
                self._client.get(PROTONS_URL),
                self._client.get(XRAYS_URL),
                return_exceptions=True,
            )

            latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000.0
            self._last_latency_ms = round(latency_ms, 1)

            records: list[NormalizedRecord] = []
            feed_provenance = ProvenanceClass.LIVE_PUBLIC_FEED

            # 1. Parse Kp Index
            kp_val: float | None = None
            if isinstance(kp_res, httpx.Response) and kp_res.status_code == 200:
                data = kp_res.json()
                if isinstance(data, list) and len(data) > 0:
                    latest = data[-1]
                    # Format: {"time_tag": "...", "kp_index": 2.33, "estimated_kp": 2.33}
                    kp_val = float(latest.get("kp_index") or latest.get("estimated_kp") or 0.0)
                    records.append(
                        NormalizedRecord(
                            metric="planetary_k_index",
                            value=round(kp_val, 2),
                            unit="Kp (0-9)",
                            source_id=self.id,
                            provenance=feed_provenance,
                            raw_ref={"time_tag": latest.get("time_tag")},
                        )
                    )
            
            # Fallback if Kp failed
            if kp_val is None:
                kp_val = 1.67
                records.append(
                    NormalizedRecord(
                        metric="planetary_k_index",
                        value=kp_val,
                        unit="Kp (0-9)",
                        source_id=self.id,
                        provenance=ProvenanceClass.SIMULATED,
                        raw_ref={"note": "fallback baseline"},
                    )
                )

            g_level, g_label = compute_g_scale(kp_val)
            records.append(
                NormalizedRecord(
                    metric="geomagnetic_storm_g_scale",
                    value=g_level,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=feed_provenance if kp_val != 1.67 else ProvenanceClass.SIMULATED,
                    raw_ref={"label": g_label},
                )
            )

            # 2. Parse Protons
            proton_val: float | None = None
            if isinstance(proton_res, httpx.Response) and proton_res.status_code == 200:
                p_data = proton_res.json()
                if isinstance(p_data, list) and len(p_data) > 0:
                    # filter for energy >= 10 MeV
                    p_10 = [x for x in p_data if x.get("energy") == ">=10 MeV"]
                    if p_10:
                        latest_p = p_10[-1]
                        proton_val = float(latest_p.get("flux") or 0.0)
                        records.append(
                            NormalizedRecord(
                                metric="proton_flux_gt_10mev",
                                value=proton_val,
                                unit="pfu",
                                source_id=self.id,
                                provenance=feed_provenance,
                                raw_ref={"time_tag": latest_p.get("time_tag")},
                            )
                        )
            
            if proton_val is None:
                proton_val = 0.42
                records.append(
                    NormalizedRecord(
                        metric="proton_flux_gt_10mev",
                        value=proton_val,
                        unit="pfu",
                        source_id=self.id,
                        provenance=ProvenanceClass.SIMULATED,
                        raw_ref={"note": "fallback baseline"},
                    )
                )

            s_level, s_label = compute_s_scale(proton_val)
            records.append(
                NormalizedRecord(
                    metric="solar_radiation_s_scale",
                    value=s_level,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=feed_provenance if proton_val != 0.42 else ProvenanceClass.SIMULATED,
                    raw_ref={"label": s_label},
                )
            )

            # 3. Parse X-rays
            xray_val: float | None = None
            if isinstance(xray_res, httpx.Response) and xray_res.status_code == 200:
                x_data = xray_res.json()
                if isinstance(x_data, list) and len(x_data) > 0:
                    # 0.1-0.8 nm is long channel
                    x_long = [x for x in x_data if x.get("energy") == "0.1-0.8nm"]
                    if x_long:
                        latest_x = x_long[-1]
                        xray_val = float(latest_x.get("flux") or 0.0)
                        records.append(
                            NormalizedRecord(
                                metric="xray_flux_long",
                                value=xray_val,
                                unit="W/m^2",
                                source_id=self.id,
                                provenance=feed_provenance,
                                raw_ref={"time_tag": latest_x.get("time_tag")},
                            )
                        )

            if xray_val is None:
                xray_val = 1.2e-7  # B1.2 background
                records.append(
                    NormalizedRecord(
                        metric="xray_flux_long",
                        value=xray_val,
                        unit="W/m^2",
                        source_id=self.id,
                        provenance=ProvenanceClass.SIMULATED,
                        raw_ref={"note": "fallback baseline"},
                    )
                )

            r_level, r_label = compute_r_scale(xray_val)
            records.append(
                NormalizedRecord(
                    metric="radio_blackout_r_scale",
                    value=r_level,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=feed_provenance if xray_val != 1.2e-7 else ProvenanceClass.SIMULATED,
                    raw_ref={"label": r_label},
                )
            )

            self._cached_records = records
            self._cache_time = now
            self._last_success = now
            self._status = "ok"
            self._last_error = None
            return records

        except Exception as exc:
            logger.warning("NOAA SWPC fetch failed, using fallback: %s", exc)
            self._last_error = str(exc)
            self._status = "degraded"
            if self._cached_records:
                return self._cached_records
            
            # Return baseline simulated records
            fallback_records = [
                NormalizedRecord(
                    metric="planetary_k_index",
                    value=1.5,
                    unit="Kp (0-9)",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                ),
                NormalizedRecord(
                    metric="geomagnetic_storm_g_scale",
                    value=0,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                    raw_ref={"label": "G0 (Quiet/Unsettled)"},
                ),
                NormalizedRecord(
                    metric="proton_flux_gt_10mev",
                    value=0.35,
                    unit="pfu",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                ),
                NormalizedRecord(
                    metric="solar_radiation_s_scale",
                    value=0,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                    raw_ref={"label": "S0 (None)"},
                ),
                NormalizedRecord(
                    metric="xray_flux_long",
                    value=1.0e-7,
                    unit="W/m^2",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                ),
                NormalizedRecord(
                    metric="radio_blackout_r_scale",
                    value=0,
                    unit="scale (0-5)",
                    source_id=self.id,
                    provenance=ProvenanceClass.SIMULATED,
                    raw_ref={"label": "R0 (None)"},
                ),
            ]
            self._cached_records = fallback_records
            self._cache_time = now
            return fallback_records
