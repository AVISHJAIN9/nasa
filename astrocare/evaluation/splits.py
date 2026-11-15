"""AstroCare Evaluation Protocol: Audited Frozen LOPO & LOSO Splits.

Enforces strictly separate Leave-One-Person-Out (LOPO) and
Leave-One-Scenario-Out (LOSO) cross-validation folds.

Audit & Anti-Leakage Rules:
1. Manifest is tied to CONFIG_VERSION, DATA_GEN_SEED, SPLIT_SEED, and MODEL_SEED.
2. Silent regeneration is forbidden: `load_frozen_splits()` strictly validates the artifact
   existence and integrity against stored SHA-256 hashes, raising an error upon mismatch.
3. LOPO completely isolates the held-out astronaut (`crew_id`) from all fitting, prior estimation,
   and hyperparameter tuning.
4. LOSO completely isolates the held-out hazard scenario family across all runs and seeds.
5. No row-level random splitting allowed.
6. Honest Source Provenance: The simulator configuration hash is explicitly distinguished from
   real-world dataset file hashes. Evaluator acknowledges synthetic proxy nature of data.
"""
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from astrocare.config import (
    CONFIG_VERSION,
    DATA_GEN_SEED,
    MODEL_SEED,
    SPLIT_SEED,
)
from astrocare.simulator.hazards import SCENARIOS

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FROZEN_SPLIT_ARTIFACT_PATH = REPO_ROOT / "artifacts" / "splits" / "frozen_eval_splits_v2.json"


@dataclass(frozen=True)
class LOPOFold:
    fold_id: str
    held_out_crew_id: str
    train_crew_ids: List[str]
    warmup_steps_online_cal: int = 30  # Fixed pre-declared unlabeled warmup window


@dataclass(frozen=True)
class LOSOFold:
    fold_id: str
    held_out_scenario: str
    train_scenarios: List[str]


@dataclass
class FrozenEvaluationDesign:
    config_version: str
    data_gen_seed: int
    split_seed: int
    model_seed: int
    lopo_folds: List[Dict[str, Any]]
    loso_folds: List[Dict[str, Any]]
    hash_sha256: str
    simulator_config_hash: str
    dataset_manifest_hash: str  # Explicit hash of installed real data files (empty when synthetic only)
    real_data_manifest: Dict[str, Any]
    disclaimer: str
    notes: str


def compute_simulator_config_hash() -> str:
    """Computes a deterministic cryptographic hash of simulator configuration, crew baselines, scenario definitions, and engine equations (Defect 34)."""
    from astrocare.config import METRIC_REGISTRY
    from astrocare.simulator.engine import get_default_crew

    engine_py_path = REPO_ROOT / "astrocare" / "simulator" / "engine.py"
    engine_bytes = engine_py_path.read_bytes() if engine_py_path.exists() else b""
    engine_hash = hashlib.sha256(engine_bytes).hexdigest()

    config_dict = {
        "config_version": CONFIG_VERSION,
        "data_gen_seed": DATA_GEN_SEED,
        "split_seed": SPLIT_SEED,
        "model_seed": MODEL_SEED,
        "scenarios": {k: asdict(v) for k, v in SCENARIOS.items()},
        "crew_cohort": [asdict(c) for c in get_default_crew()],
        "metric_registry": {k: asdict(v) for k, v in METRIC_REGISTRY.items()},
        "engine_code_hash": engine_hash,
    }
    raw = json.dumps(config_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_real_dataset_manifest() -> Tuple[Dict[str, Any], str]:
    """Inspects installed public dataset files and computes their cryptographic hashes (Defect 34, 52)."""
    real_files = []
    for rel_path in [
        "data/mmash/user_1/RR.csv",
        "data/mmash/user_1/sleep.csv",
        "data/osd575/osd575_vitals.csv",
    ]:
        p = REPO_ROOT / rel_path
        if p.exists():
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            real_files.append({"path": rel_path.replace("\\", "/"), "sha256": h, "size_bytes": p.stat().st_size})

    if real_files:
        manifest = {
            "status": "LOCAL_REAL_DATA_FILES_INSTALLED",
            "files": real_files,
            "source_disclaimer": "Local real public dataset fixture files detected (PhysioNet MMASH ODbL 1.0, NASA OSDR-575 Public Domain).",
        }
        manifest_hash = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode("utf-8")).hexdigest()
    else:
        manifest = {
            "status": "NO_LOCAL_REAL_DATA_FILES",
            "files": [],
            "source_disclaimer": "No real public datasets are currently loaded locally; splits are defined over synthetic simulator telemetry.",
        }
        manifest_hash = ""
    return manifest, manifest_hash


def generate_frozen_splits() -> FrozenEvaluationDesign:
    """Constructs the canonical LOPO and LOSO evaluation split design."""
    crew_ids = ["ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"]

    # LOPO: Each fold holds out 1 crew member completely
    lopo: List[LOPOFold] = []
    for cid in crew_ids:
        train_cids = [c for c in crew_ids if c != cid]
        lopo.append(
            LOPOFold(
                fold_id=f"LOPO_{cid}",
                held_out_crew_id=cid,
                train_crew_ids=train_cids,
                warmup_steps_online_cal=30,
            )
        )

    # LOSO: Each fold holds out 1 entire hazard scenario family
    scenario_names = [s for s in SCENARIOS.keys() if s != "nominal"]
    loso: List[LOSOFold] = []
    for s_name in sorted(scenario_names):
        train_s = ["nominal"] + [s for s in scenario_names if s != s_name]
        loso.append(
            LOSOFold(
                fold_id=f"LOSO_{s_name}",
                held_out_scenario=s_name,
                train_scenarios=train_s,
            )
        )

    lopo_dicts = [asdict(f) for f in lopo]
    loso_dicts = [asdict(f) for f in loso]

    sim_cfg_hash = compute_simulator_config_hash()
    real_manifest, dataset_manifest_hash = compute_real_dataset_manifest()

    disclaimer_text = (
        "Synthetic engineering test on simulated telemetry. Because the simulator generates both "
        "the measurements and the labels, LOPO/LOSO cross-validation prevents algorithmic data leakage "
        "across synthetic folds, but does NOT establish real-world clinical ground truth."
    )

    payload_for_digest = {
        "config_version": CONFIG_VERSION,
        "data_gen_seed": DATA_GEN_SEED,
        "split_seed": SPLIT_SEED,
        "model_seed": MODEL_SEED,
        "simulator_config_hash": sim_cfg_hash,
        "dataset_manifest_hash": dataset_manifest_hash,
        "real_data_manifest": real_manifest,
        "disclaimer": disclaimer_text,
        "lopo": lopo_dicts,
        "loso": loso_dicts,
    }
    raw_payload = json.dumps(payload_for_digest, sort_keys=True)
    digest = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    design = FrozenEvaluationDesign(
        config_version=CONFIG_VERSION,
        data_gen_seed=DATA_GEN_SEED,
        split_seed=SPLIT_SEED,
        model_seed=MODEL_SEED,
        lopo_folds=lopo_dicts,
        loso_folds=loso_dicts,
        hash_sha256=digest,
        simulator_config_hash=sim_cfg_hash,
        dataset_manifest_hash=dataset_manifest_hash,
        real_data_manifest=real_manifest,
        disclaimer=disclaimer_text,
        notes="Strict frozen split design: LOPO holds out astronauts; LOSO holds out entire scenario families. No row-level leakage.",
    )
    return design


def save_frozen_splits(output_path: Optional[Path] = None) -> Path:
    target = output_path or FROZEN_SPLIT_ARTIFACT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    design = generate_frozen_splits()
    with open(target, "w", encoding="utf-8") as f:
        json.dump(asdict(design), f, indent=2)
    return target


def load_frozen_splits(artifact_path: Optional[Path] = None) -> FrozenEvaluationDesign:
    """Loads and strictly verifies frozen splits. Silent regeneration is forbidden.
    
    Checks:
    1. Cryptographic payload digest against data['hash_sha256'].
       LIMITATION: This digest detects accidental corruption, bit rot, or partial manual edits;
       it is an integrity check, not an external digital signature against an actor with recompute ability.
    2. Stored simulator_config_hash against freshly computed current simulator configuration.
    3. Distinctness of dataset_manifest_hash (must not alias simulator_config_hash).
    4. Deterministic project seed alignment (42, 2026, 1337).
    5. Structural validation of LOPO and LOSO fold complements and strict isolation.
    """
    target = artifact_path or FROZEN_SPLIT_ARTIFACT_PATH
    if not target.exists():
        raise FileNotFoundError(
            f"Frozen evaluation split artifact missing at {target}. "
            f"Silent regeneration forbidden. Run 'python -m astrocare.evaluation.splits' or 'make splits' to initialize."
        )

    with open(target, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except Exception as exc:
            raise ValueError(f"Malformed JSON in split manifest at {target}: {exc}") from exc

    # 1. Verify self-contained payload checksum
    payload_for_digest = {
        "config_version": data["config_version"],
        "data_gen_seed": data["data_gen_seed"],
        "split_seed": data["split_seed"],
        "model_seed": data["model_seed"],
        "simulator_config_hash": data.get("simulator_config_hash", ""),
        "dataset_manifest_hash": data.get("dataset_manifest_hash", ""),
        "real_data_manifest": data.get("real_data_manifest", {"status": "NO_LOCAL_REAL_DATA_FILES", "files": []}),
        "disclaimer": data.get("disclaimer", ""),
        "lopo": data["lopo_folds"],
        "loso": data["loso_folds"],
    }
    recomputed_digest = hashlib.sha256(json.dumps(payload_for_digest, sort_keys=True).encode("utf-8")).hexdigest()

    if recomputed_digest != data.get("hash_sha256"):
        raise ValueError(
            f"Integrity check failed: split manifest at {target} has been modified or corrupted! "
            f"Expected SHA-256: {data.get('hash_sha256')}, Recomputed: {recomputed_digest}"
        )

    # 2. Check for stale simulator configuration against freshly computed current hash
    current_sim_hash = compute_simulator_config_hash()
    if data.get("simulator_config_hash") != current_sim_hash:
        raise ValueError(
            f"Stale simulator configuration in {target}: stored hash '{data.get('simulator_config_hash')}' "
            f"does not match current configuration hash '{current_sim_hash}'. "
            f"Re-run 'python -m astrocare.evaluation.splits' to update splits explicitly."
        )

    # 3. Check for illegal dataset_manifest_hash aliasing to simulator_config_hash
    stored_dm_hash = data.get("dataset_manifest_hash", "")
    if stored_dm_hash and stored_dm_hash == current_sim_hash:
        raise ValueError(
            f"Invalid split manifest at {target}: dataset_manifest_hash must NOT alias simulator_config_hash!"
        )

    # 4. Validate seed values
    if data["data_gen_seed"] != DATA_GEN_SEED or data["split_seed"] != SPLIT_SEED or data["model_seed"] != MODEL_SEED:
        raise ValueError(
            f"Seed mismatch in {target}: expected DG={DATA_GEN_SEED}, S={SPLIT_SEED}, M={MODEL_SEED}; "
            f"found DG={data['data_gen_seed']}, S={data['split_seed']}, M={data['model_seed']}"
        )

    # 5. Validate fold structure, complements, and strict isolation
    expected_cids = {"ASTRO-01", "ASTRO-02", "ASTRO-03", "ASTRO-04"}
    lopo_folds = data.get("lopo_folds", [])
    if len(lopo_folds) != 4:
        raise ValueError(f"Invalid LOPO fold count: expected 4 folds, got {len(lopo_folds)}")

    for fold in lopo_folds:
        held_out = fold["held_out_crew_id"]
        train_cids = set(fold["train_crew_ids"])
        if held_out in train_cids:
            raise ValueError(f"Data leakage in LOPO fold {fold.get('fold_id')}: {held_out} in train_crew_ids!")
        if train_cids | {held_out} != expected_cids:
            raise ValueError(f"Incomplete crew complement in LOPO fold {fold.get('fold_id')}: union != {expected_cids}")
        if fold.get("warmup_steps_online_cal") != 30:
            raise ValueError(f"Invalid warmup window in LOPO fold {fold.get('fold_id')}: expected 30 steps")

    expected_scenarios = set(SCENARIOS.keys()) - {"nominal"}
    loso_folds = data.get("loso_folds", [])
    if len(loso_folds) != len(expected_scenarios):
        raise ValueError(f"Invalid LOSO fold count: expected {len(expected_scenarios)}, got {len(loso_folds)}")

    for fold in loso_folds:
        held_out_scen = fold["held_out_scenario"]
        train_scens = set(fold["train_scenarios"])
        if held_out_scen in train_scens:
            raise ValueError(f"Data leakage in LOSO fold {fold.get('fold_id')}: {held_out_scen} in train_scenarios!")
        if "nominal" not in train_scens:
            raise ValueError(f"Missing nominal in LOSO fold {fold.get('fold_id')}: 'nominal' must be in train_scenarios!")
        if train_scens | {held_out_scen} != set(SCENARIOS.keys()):
            raise ValueError(f"Incomplete scenario complement in LOSO fold {fold.get('fold_id')}")

    return FrozenEvaluationDesign(**data)


if __name__ == "__main__":
    p = save_frozen_splits()
    print(f"Frozen evaluation split artifact saved to {p}")
    loaded = load_frozen_splits(p)
    print(f"Loaded and verified split design. Manifest SHA-256: {loaded.hash_sha256}")

