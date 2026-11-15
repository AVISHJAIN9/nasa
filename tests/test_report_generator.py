"""Tests for AstroCare F147 Report Auto-Generator (Audited)."""
import json
from pathlib import Path
import tempfile
import pytest

from astrocare.evaluation.report_generator import generate_f147_report


def test_f147_report_generation_from_summary():
    """Verifies F147 report is successfully built from fixture eval summary (Defect N11)."""
    fixture_summary = {
        "run_id": "RUN-20261115-FIXTURE-001",
        "timestamp_utc": "2026-11-15T10:00:00Z",
        "config_version": "0.2.0",
        "data_gen_seed": 42,
        "split_seed": 2026,
        "model_seed": 1337,
        "frozen_split_sha256": "abcdef1234567890abcdef1234567890",
        "data_source_label": "SYNTHETIC_SIMULATOR_TELEMETRY",
        "scientific_disclaimer": "Controlled synthetic evaluation test.",
        "equal_far_test_status": "PASS / MET",
        "lopo_summary": {
            "online_calibration_mean_coverage": 0.915,
            "cold_start_mean_coverage": 0.880,
            "online_calibration_mean_brier_overall": 0.042,
            "mean_latency_steps": {"x02": 5.2, "f018_robust_z": 2.4, "fixed_threshold": 4.1},
            "per_metric_aggregate": {
                "heart_rate": {"unit": "bpm", "mean_coverage": 0.92, "mean_interval_width": 8.5},
            }
        },
        "lopo_online_cal": {
            "ASTRO-01": {"nominal_90_coverage": 0.92, "brier_score_overall": 0.04},
        },
        "latency_comparison": {
            "ASTRO-01": {"x02_latency_steps": 5},
        },
        "loso_aggregate_evaluation": {
            "isolation_forest": {"target_validation_fpr": 0.05, "empirical_test_fpr": 0.048, "recall": 0.85, "precision": 0.72, "auroc": 0.91},
            "ensemble": {"auroc": 0.93},
        },
        "loso_per_metric_evaluation": {
            "heart_rate": {
                "aggregate": {
                    "isolation_forest": {"target_validation_fpr": 0.05, "empirical_test_fpr": 0.048, "recall": 0.85, "precision": 0.72, "false_alarms_per_crew_day": 3.2, "auroc": 0.91, "pr_auc": 0.82},
                }
            }
        },
        "policy_summary": {
            "X01_OPTIMAL": [{"delay_minutes": 0, "missed_deteriorations": 0, "unnecessary_actions": 1, "mean_cost_per_incident": 12.5}],
            "ALWAYS_WAIT": [{"delay_minutes": 0, "missed_deteriorations": 1, "unnecessary_actions": 0, "mean_cost_per_incident": 25.0}],
            "ALWAYS_ACT": [{"delay_minutes": 0, "missed_deteriorations": 0, "unnecessary_actions": 2, "mean_cost_per_incident": 18.0}],
        },
        "x06_offline_summary": {
            "status": "PASS",
            "supported_questions": {"supported_answer_rate": 1.0, "answered": 50},
            "red_team_benchmark": {"refusal_rate": 0.96, "refusals_or_escalations": 48, "critical_failures": 0, "critical_failure_rate": 0.0},
            "hardware_and_performance": {"process_ram_mb": 142.5},
        },
        "figure_artifacts": [
            "artifacts/eval_results/x02_coverage_calibration_RUN-20261115-FIXTURE-001.png",
            "artifacts/eval_results/f041_roc_pr_curves_RUN-20261115-FIXTURE-001.png",
        ]
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = Path(tmpdir) / "eval_summary_fixture.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(fixture_summary, f)

        out_report = Path(tmpdir) / "test_F147.md"
        result_path = generate_f147_report(summary_json_path=json_path, output_path=out_report)
        assert result_path.exists()
        content = result_path.read_text(encoding="utf-8")
        assert "# F147: AstroCare ML1 Scientific Research & Benchmark Report" in content
        assert "X02 Bayesian Baseline" in content
        assert "Methods: 2-State Kalman Filter Architecture" in content
        assert "F041 Anomaly Detection Ensemble" in content
        assert "X01 Wait-or-Act Comms Delay Decision Policy" in content
        assert "C:\\Users\\ABHISHEK" not in content
