"""AstroCare F070: Communication Delay Emulator.

Provides mission-specific one-way and round-trip speed-of-light communication latencies:
- ISS / Low Earth Orbit: ~ 0.0 minutes (real-time voice/video)
- Lunar Orbit & Surface: ~ 1.3 seconds (~ 0.04 minutes) / Round-trip ~ 2.6 seconds (~ 0.08 min)
- Mars Near Conjunction: 4.0 minutes (Round-trip 8.0 min)
- Mars Mid Transit: 10.0 minutes (Round-trip 20.0 min)
- Mars Maximum Opposition / Distance: 22.0 minutes (Round-trip 44.0 min)

Decision-support prototype on synthetic and public data.
"""
from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class MissionCommsConfig:
    mission_mode: str
    one_way_delay_min: float
    round_trip_delay_min: float
    description: str


MISSION_COMMS_PRESETS: Dict[str, MissionCommsConfig] = {
    "LEO_ISS": MissionCommsConfig(
        mission_mode="LEO_ISS",
        one_way_delay_min=0.0,
        round_trip_delay_min=0.0,
        description="Low Earth Orbit: Zero latency voice and telemetry.",
    ),
    "MOON_ARTEMIS": MissionCommsConfig(
        mission_mode="MOON_ARTEMIS",
        one_way_delay_min=1.0,  # ~1-2 min operational buffer
        round_trip_delay_min=2.0,
        description="Lunar Surface / Gateway: 2-minute round-trip turnaround.",
    ),
    "MARS_NEAR": MissionCommsConfig(
        mission_mode="MARS_NEAR",
        one_way_delay_min=5.0,
        round_trip_delay_min=10.0,
        description="Mars closest approach: 10-minute round-trip latency.",
    ),
    "MARS_TRANSIT": MissionCommsConfig(
        mission_mode="MARS_TRANSIT",
        one_way_delay_min=10.0,
        round_trip_delay_min=20.0,
        description="Deep space transit: 20-minute round-trip latency.",
    ),
    "MARS_MAX_OPPOSITION": MissionCommsConfig(
        mission_mode="MARS_MAX_OPPOSITION",
        one_way_delay_min=22.0,
        round_trip_delay_min=44.0,
        description="Mars maximum solar separation: 44-minute round-trip latency.",
    ),
}


def get_configured_delay(delay_minutes: float) -> MissionCommsConfig:
    """Returns matching or custom communication delay configuration."""
    for cfg in MISSION_COMMS_PRESETS.values():
        if abs(cfg.round_trip_delay_min - delay_minutes) < 1e-3:
            return cfg
    return MissionCommsConfig(
        mission_mode="CUSTOM",
        one_way_delay_min=delay_minutes / 2.0,
        round_trip_delay_min=delay_minutes,
        description=f"Custom delay profile with {delay_minutes:.1f} min round-trip latency.",
    )
