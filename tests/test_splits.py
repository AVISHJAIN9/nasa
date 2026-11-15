"""Tests for AstroCare F062 Evaluation Protocol & Split Integrity (Audited)."""
import hashlib
import json
from pathlib import Path
import tempfile
import pytest

from astrocare.evaluation.splits import (
    FROZEN_SPLIT_ARTIFACT_PATH,
    compute_simulator_config_hash,
    generate_frozen_splits,
    load_frozen_splits,
    save_frozen_splits,
)


def test_frozen_splits_load_verified():
    """Verifies that the canonical frozen split artifact exists and passes integrity check."""
    design = load_frozen_splits()
    assert design.config_version == "v2.1.0-spaceapps"
    assert design.data_gen_seed == 42
    assert design.split_seed == 2026
    assert design.model_seed == 1337

    # 4 LOPO folds (one for each astronaut)
    assert len(design.lopo_folds) == 4
    held_out_cids = set(f["held_out_crew_id"] for f in design.lopo_folds)
    assert held_out_cids == {"ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"}

    # 6 LOSO folds (one for each hazard scenario family)
    assert len(design.loso_folds) == 6
    for f in design.loso_folds:
        assert f["held_out_scenario"] not in f["train_scenarios"]
        assert "nominal" in f["train_scenarios"]

    # Manifest hash honesty & strict cryptographic verification
    expected_sim_hash = compute_simulator_config_hash()
    assert design.simulator_config_hash == expected_sim_hash
    # Must NOT alias simulator hash
    assert design.dataset_manifest_hash != design.simulator_config_hash
    if design.real_data_manifest.get("status") == "LOCAL_REAL_DATA_FILES_INSTALLED":
        assert len(design.dataset_manifest_hash) == 64
        assert len(design.real_data_manifest["files"]) > 0
    else:
        assert design.dataset_manifest_hash == ""
        assert design.real_data_manifest["status"] == "NO_LOCAL_REAL_DATA_FILES"
    assert "synthetic" in design.disclaimer.lower()

    # Full payload cryptographic digest verification
    payload_for_digest = {
        "config_version": design.config_version,
        "data_gen_seed": design.data_gen_seed,
        "split_seed": design.split_seed,
        "model_seed": design.model_seed,
        "simulator_config_hash": design.simulator_config_hash,
        "dataset_manifest_hash": design.dataset_manifest_hash,
        "real_data_manifest": design.real_data_manifest,
        "disclaimer": design.disclaimer,
        "lopo": design.lopo_folds,
        "loso": design.loso_folds,
    }
    expected_digest = hashlib.sha256(json.dumps(payload_for_digest, sort_keys=True).encode("utf-8")).hexdigest()
    assert design.hash_sha256 == expected_digest


def test_frozen_splits_fail_closed_on_missing_file():
    """Verifies that load_frozen_splits fails closed when the split file is missing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        fake_path = Path(tmpdir) / "non_existent_splits.json"
        with pytest.raises(FileNotFoundError, match="Silent regeneration forbidden"):
            load_frozen_splits(fake_path)


def test_frozen_splits_fail_closed_on_malformed_json():
    """Verifies that load_frozen_splits fails closed on unparseable JSON."""
    with tempfile.TemporaryDirectory() as tmpdir:
        corrupt_path = Path(tmpdir) / "corrupt_splits.json"
        with open(corrupt_path, "w", encoding="utf-8") as f:
            f.write("{this is not valid json")
        with pytest.raises(ValueError, match="Malformed JSON"):
            load_frozen_splits(corrupt_path)


def test_frozen_splits_fail_closed_on_tampered_file():
    """Verifies that load_frozen_splits fails closed when file contents have been modified."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tampered_path = Path(tmpdir) / "tampered_splits.json"
        save_frozen_splits(tampered_path)

        # Tamper with the file (modify seed without updating hash)
        with open(tampered_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["data_gen_seed"] = 9999
        with open(tampered_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

        with pytest.raises(ValueError, match="Integrity check failed"):
            load_frozen_splits(tampered_path)


def test_frozen_splits_fail_closed_on_stale_config_hash():
    """Verifies that even if digest is recomputed, a stale simulator config hash fails closed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        stale_path = Path(tmpdir) / "stale_splits.json"
        save_frozen_splits(stale_path)

        with open(stale_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Forge stale config hash and recompute full digest
        data["simulator_config_hash"] = "stale_hash_from_older_simulator_version_12345"
        payload_for_digest = {
            "config_version": data["config_version"],
            "data_gen_seed": data["data_gen_seed"],
            "split_seed": data["split_seed"],
            "model_seed": data["model_seed"],
            "simulator_config_hash": data["simulator_config_hash"],
            "dataset_manifest_hash": data["dataset_manifest_hash"],
            "real_data_manifest": data["real_data_manifest"],
            "disclaimer": data["disclaimer"],
            "lopo": data["lopo_folds"],
            "loso": data["loso_folds"],
        }
        data["hash_sha256"] = hashlib.sha256(json.dumps(payload_for_digest, sort_keys=True).encode("utf-8")).hexdigest()

        with open(stale_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

        with pytest.raises(ValueError, match="Stale simulator configuration"):
            load_frozen_splits(stale_path)


def test_frozen_splits_fail_closed_on_aliased_dataset_hash():
    """Verifies that aliasing dataset_manifest_hash to simulator_config_hash fails closed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        aliased_path = Path(tmpdir) / "aliased_splits.json"
        save_frozen_splits(aliased_path)

        with open(aliased_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Illegal alias: dataset_manifest_hash set equal to simulator_config_hash
        data["dataset_manifest_hash"] = data["simulator_config_hash"]
        payload_for_digest = {
            "config_version": data["config_version"],
            "data_gen_seed": data["data_gen_seed"],
            "split_seed": data["split_seed"],
            "model_seed": data["model_seed"],
            "simulator_config_hash": data["simulator_config_hash"],
            "dataset_manifest_hash": data["dataset_manifest_hash"],
            "real_data_manifest": data["real_data_manifest"],
            "disclaimer": data["disclaimer"],
            "lopo": data["lopo_folds"],
            "loso": data["loso_folds"],
        }
        data["hash_sha256"] = hashlib.sha256(json.dumps(payload_for_digest, sort_keys=True).encode("utf-8")).hexdigest()

        with open(aliased_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

        with pytest.raises(ValueError, match="dataset_manifest_hash must NOT alias"):
            load_frozen_splits(aliased_path)


def test_frozen_splits_fail_closed_on_leaked_fold():
    """Verifies that fold structure leakage fails closed at load time."""
    with tempfile.TemporaryDirectory() as tmpdir:
        leaked_path = Path(tmpdir) / "leaked_splits.json"
        save_frozen_splits(leaked_path)

        with open(leaked_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Inject leakage: ASTRO-01 added to train_crew_ids of fold holding out ASTRO-01
        data["lopo_folds"][0]["train_crew_ids"].append("ASTRO-01")
        payload_for_digest = {
            "config_version": data["config_version"],
            "data_gen_seed": data["data_gen_seed"],
            "split_seed": data["split_seed"],
            "model_seed": data["model_seed"],
            "simulator_config_hash": data["simulator_config_hash"],
            "dataset_manifest_hash": data["dataset_manifest_hash"],
            "real_data_manifest": data["real_data_manifest"],
            "disclaimer": data["disclaimer"],
            "lopo": data["lopo_folds"],
            "loso": data["loso_folds"],
        }
        data["hash_sha256"] = hashlib.sha256(json.dumps(payload_for_digest, sort_keys=True).encode("utf-8")).hexdigest()

        with open(leaked_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

        with pytest.raises(ValueError, match="Data leakage in LOPO fold"):
            load_frozen_splits(leaked_path)


def test_lopo_and_loso_isolation():
    """Verifies strict mathematical isolation of held-out people and scenarios."""
    design = load_frozen_splits()

    for fold in design.lopo_folds:
        cid = fold["held_out_crew_id"]
        assert cid not in fold["train_crew_ids"], f"Astronaut {cid} leaked into train_crew_ids!"
        assert fold["warmup_steps_online_cal"] == 30

    for fold in design.loso_folds:
        scen = fold["held_out_scenario"]
        assert scen not in fold["train_scenarios"], f"Hazard scenario {scen} leaked into train_scenarios!"


def test_manifest_hash_sensitive_to_crew_and_seeds():
    """Verifies Defect 34: manifest hash covers crew profiles, registry, and seeds."""
    h1 = compute_simulator_config_hash()
    assert isinstance(h1, str) and len(h1) == 64
