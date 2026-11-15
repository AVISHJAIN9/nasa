"""AstroCare v2 - Behaviour Events Ingestion & 5-Minute Window Aggregation (BE-04 / A02)."""

import math
from collections import defaultdict
from typing import Any

from backend.app.db.models.behavior import BehaviorWindow
from backend.app.models.behavior import BehaviorEventItem, BehaviorWindowResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# In-memory storage for raw events to support dynamic window recomputation upon late arrivals
_events_by_window: dict[tuple[str, int], list[BehaviorEventItem]] = defaultdict(list)
_seen_event_ids: set[str] = set()


def _percentile(values: list[float], p: float) -> float:
    """Calculate the p-th percentile of sorted values."""
    if not values:
        return 0.0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_v[int(k)]
    return sorted_v[f] * (c - k) + sorted_v[c] * (k - f)


def _std_dev(values: list[float], mean_val: float) -> float:
    """Calculate sample standard deviation."""
    if len(values) <= 1:
        return 0.0
    variance = sum((x - mean_val) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)


def compute_window_statistics(
    crew_id: str,
    window_start: int,
    window_end: int,
    events: list[BehaviorEventItem],
) -> dict[str, Any]:
    """Compute all required summary statistics across events in a 5-minute bucket."""
    dwells = [e.dwell_ms for e in events if e.dwell_ms > 0]
    flights = [e.flight_ms for e in events if e.flight_ms > 0]
    speeds = [e.speed_px_s for e in events if e.speed_px_s > 0]

    dwell_mean = sum(dwells) / len(dwells) if dwells else 0.0
    dwell_median = _percentile(dwells, 50.0)
    dwell_std = _std_dev(dwells, dwell_mean)
    dwell_p90 = _percentile(dwells, 90.0)

    flight_mean = sum(flights) / len(flights) if flights else 0.0
    flight_median = _percentile(flights, 50.0)
    flight_std = _std_dev(flights, flight_mean)
    flight_p90 = _percentile(flights, 90.0)

    speed_mean = sum(speeds) / len(speeds) if speeds else 0.0
    speed_std = _std_dev(speeds, speed_mean)

    # Estimate idle ratio: fraction of 5-min window (300,000 ms) without active dwell
    total_active_ms = sum(dwells)
    window_duration_ms = float(window_end - window_start)
    idle_ratio = max(0.0, min(1.0, (window_duration_ms - total_active_ms) / window_duration_ms))

    return {
        "crew_id": crew_id,
        "window_start": window_start,
        "window_end": window_end,
        "event_count": len(events),
        "dwell_mean": round(dwell_mean, 2),
        "dwell_median": round(dwell_median, 2),
        "dwell_std": round(dwell_std, 2),
        "dwell_p90": round(dwell_p90, 2),
        "flight_mean": round(flight_mean, 2),
        "flight_median": round(flight_median, 2),
        "flight_std": round(flight_std, 2),
        "flight_p90": round(flight_p90, 2),
        "idle_ratio": round(idle_ratio, 4),
        "pointer_speed_mean": round(speed_mean, 2),
        "pointer_speed_std": round(speed_std, 2),
    }


async def ingest_and_aggregate_behavior_events(
    events: list[BehaviorEventItem],
    session: AsyncSession,
) -> list[BehaviorWindowResponse]:
    """Ingest a batch of behavior events, update 5-minute windows, and handle late arrivals."""
    updated_windows: list[BehaviorWindowResponse] = []
    affected_windows: set[tuple[str, int]] = set()

    WINDOW_SIZE_MS = 5 * 60 * 1000  # 300,000 ms = 5 minutes

    for event in events:
        # Idempotency: skip already seen event_id
        if event.event_id in _seen_event_ids:
            continue
        _seen_event_ids.add(event.event_id)

        w_start = (event.ts_ms // WINDOW_SIZE_MS) * WINDOW_SIZE_MS
        key = (event.crew_id, w_start)
        _events_by_window[key].append(event)
        affected_windows.add(key)

    # Recompute and upsert each affected window
    for crew_id, w_start in affected_windows:
        w_end = w_start + WINDOW_SIZE_MS
        all_events = _events_by_window[(crew_id, w_start)]
        stats = compute_window_statistics(crew_id, w_start, w_end, all_events)

        # Check existing window in database
        stmt = select(BehaviorWindow).where(
            BehaviorWindow.crew_id == crew_id,
            BehaviorWindow.window_start == w_start,
        )
        result = await session.execute(stmt)
        record = result.scalar_one_or_none()

        if record:
            for k, v in stats.items():
                setattr(record, k, v)
        else:
            record = BehaviorWindow(**stats)
            session.add(record)

        await session.commit()
        await session.refresh(record)

        updated_windows.append(
            BehaviorWindowResponse(
                crew_id=record.crew_id,
                window_start=record.window_start,
                window_end=record.window_end,
                event_count=record.event_count,
                dwell_mean=record.dwell_mean,
                dwell_median=record.dwell_median,
                dwell_std=record.dwell_std,
                dwell_p90=record.dwell_p90,
                flight_mean=record.flight_mean,
                flight_median=record.flight_median,
                flight_std=record.flight_std,
                flight_p90=record.flight_p90,
                idle_ratio=record.idle_ratio,
                pointer_speed_mean=record.pointer_speed_mean,
                pointer_speed_std=record.pointer_speed_std,
            )
        )

    return updated_windows


async def get_behavior_windows(
    crew_id: str,
    from_ts: int,
    to_ts: int,
    session: AsyncSession,
) -> list[BehaviorWindowResponse]:
    """Query aggregated 5-minute behavior windows for a crew member in a time range."""
    stmt = (
        select(BehaviorWindow)
        .where(
            BehaviorWindow.crew_id == crew_id,
            BehaviorWindow.window_start >= from_ts,
            BehaviorWindow.window_end <= to_ts,
        )
        .order_by(BehaviorWindow.window_start)
    )
    result = await session.execute(stmt)
    records = result.scalars().all()

    return [
        BehaviorWindowResponse(
            crew_id=r.crew_id,
            window_start=r.window_start,
            window_end=r.window_end,
            event_count=r.event_count,
            dwell_mean=r.dwell_mean,
            dwell_median=r.dwell_median,
            dwell_std=r.dwell_std,
            dwell_p90=r.dwell_p90,
            flight_mean=r.flight_mean,
            flight_median=r.flight_median,
            flight_std=r.flight_std,
            flight_p90=r.flight_p90,
            idle_ratio=r.idle_ratio,
            pointer_speed_mean=r.pointer_speed_mean,
            pointer_speed_std=r.pointer_speed_std,
        )
        for r in records
    ]
