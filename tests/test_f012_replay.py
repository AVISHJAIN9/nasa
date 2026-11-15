"""Tests for AstroCare F012 Real Public Proxy & Flight Replay Adapters."""
import pytest
from astrocare.data.f012_replay import (
    MMASHReplayAdapter,
    OSD575Inspiration4Adapter,
    MMASH_PROVENANCE,
    OSD575_PROVENANCE,
)
from astrocare.models.f041_anomaly import APPROVED_BODY_REGIONS


def test_mmash_provenance_and_licensing():
    """Verifies PhysioNet MMASH provenance, ODbL 1.0 license, and proxy disclaimer."""
    adapter = MMASHReplayAdapter(seed=42)
    prov = adapter.get_provenance()

    assert prov.source_id == "physionet_mmash"
    assert "ODbL 1.0" in prov.license
    assert prov.is_astronaut_data is False
    assert prov.subjects_count == 22
    assert "glucose" not in prov.supported_metrics, "MMASH must explicitly disclaim glucose availability"
    assert "heart_rate" in prov.supported_metrics
    assert "sleep_hours" in prov.supported_metrics
    assert prov.url == "https://physionet.org/content/mmash/1.0.0/"


def test_mmash_streaming_telemetry():
    """Verifies MMASH replay stream outputs valid TelemetryRecords."""
    adapter = MMASHReplayAdapter(seed=42)
    # Stream 450 minutes (00:00 to 07:30 UTC), crossing 07:00 wake
    records = list(adapter.stream_subject_telemetry(subject_id="MMASH-01", total_steps=450, step_seconds=60.0))

    hr_recs = [r for r in records if r.metric == "heart_rate"]
    sleep_recs = [r for r in records if r.metric == "sleep_hours"]

    assert len(hr_recs) == 450
    assert len(sleep_recs) == 1, "Expected single daily sleep reading at 07:00 wake"
    assert sleep_recs[0].unit == "hours"
    assert 5.0 <= sleep_recs[0].value <= 10.0

    for r in records:
        assert r.crew_id == "MMASH-01"
        assert r.is_simulated is False
        assert r.body_region in APPROVED_BODY_REGIONS
        assert r.synthetic_label == 0


def test_osd575_inspiration4_provenance():
    """Verifies NASA OSDR OSD-575 Inspiration4 provenance and public domain terms."""
    adapter = OSD575Inspiration4Adapter(seed=1337)
    prov = adapter.get_provenance()

    assert prov.source_id == "nasa_osdr_osd_575"
    assert "Public Domain" in prov.license or "17 U.S.C. § 105" in prov.license
    assert prov.is_astronaut_data is True
    assert prov.subjects_count == 4
    assert prov.url == "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575"

    meta = adapter.get_mission_metadata()
    assert meta["mission"] == "Inspiration4"
    assert meta["launch_date"] == "2021-09-16T00:02:56Z"  # Defect 52: UTC launch
    assert len(meta["crew_ids"]) == 4
    assert "FD2" in meta["timepoints"]
    assert "R+1" in meta["timepoints"]


def test_osd575_streaming_telemetry():
    """Verifies Inspiration4 streaming telemetry across mission epochs."""
    adapter = OSD575Inspiration4Adapter(seed=1337)
    records = list(adapter.stream_mission_telemetry(crew_id="I4-2", timepoint="FD2", total_steps=20))

    assert len(records) == 20 * 3  # HR, SBP, Temp per step
    for r in records:
        assert r.crew_id == "I4-2"
        assert r.is_simulated is False
        assert r.body_region in APPROVED_BODY_REGIONS
        assert r.scenario == "inspiration4_FD2"
        assert r.hazard_tag == "gravity"

    # Pre-flight epoch should have hazard_tag = None
    pre_records = list(adapter.stream_mission_telemetry(crew_id="I4-2", timepoint="L-3", total_steps=5))
    for r in pre_records:
        assert r.hazard_tag is None


def test_osd575_invalid_parameters():
    adapter = OSD575Inspiration4Adapter()
    with pytest.raises(ValueError, match="Invalid Inspiration4 crew ID"):
        list(adapter.stream_mission_telemetry(crew_id="INVALID_ID"))

    with pytest.raises(ValueError, match="Invalid timepoint"):
        list(adapter.stream_mission_telemetry(crew_id="I4-1", timepoint="INVALID_TIMEPOINT"))


def test_f012_dataset_loaders_fail_closed_and_honest():
    """Verifies Defect 51, 54, 55: Loaders fail closed on missing data, return honest status in fallback."""
    from astrocare.data.f012_replay import load_mmash_dataset, load_osd575_dataset
    from pathlib import Path

    fake_path = Path("non_existent_dir_12345")
    # Fail closed by default
    with pytest.raises(FileNotFoundError, match="Fail-closed"):
        load_mmash_dataset(fake_path, allow_synthetic_fallback=False)

    with pytest.raises(FileNotFoundError, match="Fail-closed"):
        load_osd575_dataset(fake_path, allow_synthetic_fallback=False)

    # In fallback mode, must NOT claim real data with is_simulated=False
    res_mmash = load_mmash_dataset(fake_path, allow_synthetic_fallback=True)
    assert res_mmash.status == "DATASET_NOT_INSTALLED"
    assert res_mmash.is_simulated is True
    assert "https://physionet.org" in res_mmash.instructions

    res_osd = load_osd575_dataset(fake_path, allow_synthetic_fallback=True)
    assert res_osd.status == "DATASET_NOT_INSTALLED"
    assert res_osd.is_simulated is True
    assert "https://osdr.nasa.gov" in res_osd.instructions


def test_f012_real_files_checksum_and_parsing():
    """Verifies that actual local CSV files are parsed with genuine SHA-256 checksums (Defect 51, 54, 55)."""
    from astrocare.data.f012_replay import load_mmash_dataset, load_osd575_dataset

    res_mmash = load_mmash_dataset()
    assert res_mmash.status == "LOADED_LOCAL_FILE"
    assert res_mmash.is_simulated is False
    assert res_mmash.records_count > 0
    assert len(res_mmash.checksum_sha256) == 64
    assert res_mmash.checksum_sha256 != "4d1e7c5b6a3f9e8a1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b"

    res_osd = load_osd575_dataset()
    assert res_osd.status == "LOADED_LOCAL_FILE"
    assert res_osd.is_simulated is False
    assert res_osd.records_count > 0
    assert len(res_osd.checksum_sha256) == 64
    assert res_osd.checksum_sha256 != "8b2c4e6a0f1d3e5b7a9c1e3f5a7b9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c"
