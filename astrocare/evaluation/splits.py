"""AstroCare Evaluation Protocol: Frozen LOPO & LOSO Splits.

Enforces strictly separate Leave-One-Person-Out (LOPO) and
Leave-One-Scenario-Out (LOSO) cross-validation folds.
Saves frozen assignments, seeds, and cryptographic hashes to a versioned artifact
BEFORE model fitting or threshold calibration.
"""
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np

from astrocare.config import (
    CONFIG_VERSION,
    DATA_GEN_SEED,
    MODEL_SEED,
    SPLIT_SEED,
)
from astrocare.simulator.hazards import SCENARIOS


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
FROZEN_SPLIT_ARTIFACT_PATH = REPO_ROOT / "artifacts" / "splits" / "frozen_eval_splits_v2.json"


@dataclass
class LOPOFold:
    fold_id: str
    held_out_crew_id: str
    train_crew_ids: List[str]
    warmup_steps_online_cal: int = 30  # Fixed pre-declared unlabeled warmup window


@dataclass
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
    notes: str


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

    raw_payload = json.dumps(
        {
            "config_version": CONFIG_VERSION,
            "data_gen_seed": DATA_GEN_SEED,
            "split_seed": SPLIT_SEED,
            "model_seed": MODEL_SEED,
            "lopo": lopo_dicts,
            "loso": loso_dicts,
        },
        sort_keys=True,
    )
    digest = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

    design = FrozenEvaluationDesign(
        config_version=CONFIG_VERSION,
        data_gen_seed=DATA_GEN_SEED,
        split_seed=SPLIT_SEED,
        model_seed=MODEL_SEED,
        lopo_folds=lopo_dicts,
        loso_folds=loso_dicts,
        hash_sha256=digest,
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
    target = artifact_path or FROZEN_SPLIT_ARTIFACT_PATH
    if not target.exists():
        save_frozen_splits(target)
    with open(target, "r", encoding="utf-8") as f:
        data = json.load(f)
    return FrozenEvaluationDesign(**data)


if __name__ == "__main__":
    p = save_frozen_splits()
    print(f"Frozen evaluation split artifact saved to {p}")
