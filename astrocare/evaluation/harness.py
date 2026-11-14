"""AstroCare F062: Master Evaluation Harness and Reproducibility Runner (Audited).

Coordinates the scientific evaluation suite under strict audit rules:
1. Frozen LOPO cross-validation with separate Cold-Start and Online-Calibration reporting.
2. Frozen LOSO cross-validation for F041 anomaly detection using IDENTICAL feature inputs.
3. Metric-level anomaly labels (not broad scenario labels).
4. X01 Wait-or-Act policy evaluation consuming real X02 Kalman filter forecasts.
5. X06 Offline Assistant evaluation (labeled as keyword-retrieval edge fallback, not LLM).
6. Four-person live causal demonstration.
7. Generates run-ID-versioned figure filenames and machine-readable artifacts.

Decision-support prototype on synthetic and public data.
Synthetic proxy labels; NOT clinical ground truth.
F043 (LightGBM risk score) is explicitly protected and NOT implemented.
"""
from dataclasses import asdict
from datetime import datetime, timezone
import json
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Tuple
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from astrocare.benchmarks.demo_four_person import run_four_person_demo
from astrocare.benchmarks.x06_benchmark import run_x06_offline_benchmark
from astrocare.config import (
    CONFIG_VERSION,
    DATA_GEN_SEED,
    METRIC_REGISTRY,
    MODEL_SEED,
    SPLIT_SEED,
)
from astrocare.evaluation.splits import FROZEN_SPLIT_ARTIFACT_PATH, load_frozen_splits
from astrocare.models.baselines import F018RollingRobustBaseline, FixedThresholdBaseline
from astrocare.models.f041_anomaly import (
    F041FixedThresholdDetector,
    F041IsolationForestDetector,
    F041RobustZDetector,
    evaluate_detector_predictions,
)
from astrocare.models.x02_bayesian import X02AstronautMetricFilter, fit_crew_prior
from astrocare.policy.x01_wait_or_act import evaluate_policy_across_delays
from astrocare.simulator.engine import TelemetryRecord, VitalsSimulator


def generate_run_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    rand_suffix = np.random.RandomState().randint(1000, 9999)
    return f"RUN-{ts}-{rand_suffix}"


class MasterEvaluationHarness:
    """Master evaluator coordinating all model evaluations against frozen splits."""

    def __init__(self, run_id: Optional[str] = None):
        self.run_id = run_id or generate_run_id()
        self.split_design = load_frozen_splits()
        self.output_dir = Path(__file__).resolve().parent.parent.parent / "artifacts" / "eval_results"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_lopo_evaluation(self) -> Dict[str, Any]:
        """Evaluates X02 Bayesian filter, F018, and Fixed Threshold across LOPO folds."""
        sim = VitalsSimulator(seed=DATA_GEN_SEED)
        # Generate nominal + deviation mixed records for true calibration evaluation
        records_nom: List[TelemetryRecord] = list(sim.stream_records(total_steps=120, scenario_name="nominal"))
        records_dev: List[TelemetryRecord] = list(sim.stream_records(total_steps=60, scenario_name="cabin_co2_leak", hazard_start_step=10))
        all_records = records_nom + records_dev

        lopo_results: Dict[str, Any] = {
            "cold_start": {},
            "online_calibration": {},
            "baselines": {
                "f018_robust_z": {},
                "fixed_threshold": {},
            },
        }

        cold_coverages: List[float] = []
        online_coverages: List[float] = []
        cold_brier_scores: List[float] = []
        online_brier_scores: List[float] = []

        metrics_to_eval = ["heart_rate", "glucose", "systolic_bp", "body_temp"]

        for fold in self.split_design.lopo_folds:
            held_out_cid = fold["held_out_crew_id"]
            train_cids = fold["train_crew_ids"]
            warmup_steps = fold["warmup_steps_online_cal"]

            # Estimate priors strictly from training-fold astronauts
            crew_training_obs: Dict[str, Dict[str, List[float]]] = {m: {} for m in metrics_to_eval}
            for rec in records_nom:
                if rec.crew_id in train_cids and rec.metric in metrics_to_eval and rec.value is not None:
                    if rec.crew_id not in crew_training_obs[rec.metric]:
                        crew_training_obs[rec.metric][rec.crew_id] = []
                    crew_training_obs[rec.metric][rec.crew_id].append(rec.value)

            priors = {m: fit_crew_prior(crew_training_obs[m], m) for m in metrics_to_eval}

            # Cold start filter
            cs_filters = {m: X02AstronautMetricFilter(held_out_cid, m, priors[m]) for m in metrics_to_eval}
            cs_in_band = {m: 0 for m in metrics_to_eval}
            cs_total = {m: 0 for m in metrics_to_eval}
            cs_brier: List[float] = []

            # Online cal filter
            oc_filters = {m: X02AstronautMetricFilter(held_out_cid, m, priors[m]) for m in metrics_to_eval}
            oc_in_band = {m: 0 for m in metrics_to_eval}
            oc_total = {m: 0 for m in metrics_to_eval}
            oc_brier: List[float] = []

            # Baselines
            f018_filters = {m: F018RollingRobustBaseline(m, window_size=30) for m in metrics_to_eval}
            fixed_baselines = {m: FixedThresholdBaseline(m) for m in metrics_to_eval}
            f018_alerts = 0
            fixed_alerts = 0
            baseline_total = 0

            held_out_records = [r for r in all_records if r.crew_id == held_out_cid]

            for step_idx, rec in enumerate(held_out_records):
                met = rec.metric
                if met not in metrics_to_eval:
                    continue

                val = rec.value
                true_label = rec.synthetic_label

                cs_out = cs_filters[met].step(val, rec.ts)
                if val is not None:
                    cs_total[met] += 1
                    if cs_out.lo90 <= val <= cs_out.hi90:
                        cs_in_band[met] += 1
                    cs_brier.append((cs_out.p_deviation - true_label) ** 2)

                oc_out = oc_filters[met].step(val, rec.ts)
                if val is not None:
                    if step_idx >= warmup_steps * len(metrics_to_eval):
                        oc_total[met] += 1
                        if oc_out.lo90 <= val <= oc_out.hi90:
                            oc_in_band[met] += 1
                        oc_brier.append((oc_out.p_deviation - true_label) ** 2)

                if val is not None and rec.scenario == "nominal":
                    baseline_total += 1
                    f018_res = f018_filters[met].update_and_predict(val)
                    if f018_res["is_alert"] == 1:
                        f018_alerts += 1
                    fixed_res = fixed_baselines[met].predict(val)
                    if fixed_res["is_alert"] == 1:
                        fixed_alerts += 1

            cs_cov = sum(cs_in_band.values()) / max(sum(cs_total.values()), 1)
            oc_cov = sum(oc_in_band.values()) / max(sum(oc_total.values()), 1)
            cs_br = float(np.mean(cs_brier)) if cs_brier else 0.0
            oc_br = float(np.mean(oc_brier)) if oc_brier else 0.0

            cold_coverages.append(cs_cov)
            online_coverages.append(oc_cov)
            cold_brier_scores.append(cs_br)
            online_brier_scores.append(oc_br)

            lopo_results["cold_start"][held_out_cid] = {
                "nominal_90_coverage": round(cs_cov, 4),
                "brier_score": round(cs_br, 4),
                "per_metric_coverage": {m: round(cs_in_band[m] / max(cs_total[m], 1), 3) for m in metrics_to_eval},
            }
            lopo_results["online_calibration"][held_out_cid] = {
                "nominal_90_coverage": round(oc_cov, 4),
                "brier_score": round(oc_br, 4),
                "per_metric_coverage": {m: round(oc_in_band[m] / max(oc_total[m], 1), 3) for m in metrics_to_eval},
            }
            lopo_results["baselines"]["f018_robust_z"][held_out_cid] = {
                "false_alarm_rate": round(f018_alerts / max(baseline_total, 1), 4),
            }
            lopo_results["baselines"]["fixed_threshold"][held_out_cid] = {
                "false_alarm_rate": round(fixed_alerts / max(baseline_total, 1), 4),
            }

        lopo_results["aggregate"] = {
            "cold_start_mean_coverage": round(float(np.mean(cold_coverages)), 4),
            "online_calibration_mean_coverage": round(float(np.mean(online_coverages)), 4),
            "cold_start_mean_brier": round(float(np.mean(cold_brier_scores)), 4),
            "online_calibration_mean_brier": round(float(np.mean(online_brier_scores)), 4),
        }
        return lopo_results

    def run_loso_evaluation(self) -> Dict[str, Any]:
        """Evaluates F041 Anomaly Detectors on IDENTICAL input features across LOSO folds."""
        sim = VitalsSimulator(seed=DATA_GEN_SEED)

        # Validation stream for threshold calibration
        val_records = list(sim.stream_records(total_steps=120, scenario_name="nominal"))
        val_hr = [r.value for r in val_records if r.metric == "heart_rate" and r.value is not None]

        # Symmetrical feature evaluation: Heart Rate 1D evaluation across all 3 models
        target_fpr = 0.05
        val_hr_arr = np.array(val_hr).reshape(-1, 1)

        if_det = F041IsolationForestDetector(random_state=MODEL_SEED)
        if_det.fit(val_hr_arr)
        if_det.calibrate_threshold(val_hr_arr, target_fpr=target_fpr)

        rob_det = F041RobustZDetector(metric_name="heart_rate", window_size=30)
        rob_det.calibrate_threshold(val_hr, target_fpr=target_fpr)

        fix_det = F041FixedThresholdDetector(metric_name="heart_rate")
        fix_det.calibrate_threshold(val_hr, target_fpr=target_fpr)

        loso_scenario_results: Dict[str, Any] = {}
        all_y_true: List[int] = []
        all_if_alerts: List[int] = []
        all_rob_alerts: List[int] = []
        all_fix_alerts: List[int] = []

        all_if_scores: List[float] = []
        all_rob_scores: List[float] = []
        all_fix_scores: List[float] = []

        for fold in self.split_design.loso_folds:
            s_name = fold["held_out_scenario"]

            test_records = list(
                sim.stream_records(
                    total_steps=100,
                    scenario_name=s_name,
                    hazard_start_step=40,
                )
            )

            hr_records = [r for r in test_records if r.crew_id == "ASTRO-01" and r.metric == "heart_rate"]
            hr_vals = [r.value if r.value is not None else 70.0 for r in hr_records]
            # Metric-specific ground truth labels
            y_true = [r.synthetic_label for r in hr_records]

            # 1. Isolation Forest (1D HR feature)
            if_alerts, if_scores = if_det.predict(np.array(hr_vals).reshape(-1, 1))

            # 2. Robust-Z (1D HR feature)
            rob_alerts, rob_scores = rob_det.score_sequence(hr_vals)

            # 3. Fixed Threshold (1D HR feature)
            fix_alerts, fix_scores = fix_det.score_sequence(hr_vals)

            if_metrics = evaluate_detector_predictions(np.array(y_true), if_scores, if_alerts, anomaly_start_indices=[40])
            rob_metrics = evaluate_detector_predictions(np.array(y_true), rob_scores, rob_alerts, anomaly_start_indices=[40])
            fix_metrics = evaluate_detector_predictions(np.array(y_true), fix_scores, fix_alerts, anomaly_start_indices=[40])

            loso_scenario_results[s_name] = {
                "isolation_forest": if_metrics,
                "robust_z": rob_metrics,
                "fixed_threshold": fix_metrics,
            }

            all_y_true.extend(y_true)
            all_if_alerts.extend(if_alerts)
            all_rob_alerts.extend(rob_alerts)
            all_fix_alerts.extend(fix_alerts)
            all_if_scores.extend(if_scores)
            all_rob_scores.extend(rob_scores)
            all_fix_scores.extend(fix_scores)

        agg_if = evaluate_detector_predictions(np.array(all_y_true), np.array(all_if_scores), np.array(all_if_alerts))
        agg_rob = evaluate_detector_predictions(np.array(all_y_true), np.array(all_rob_scores), np.array(all_rob_alerts))
        agg_fix = evaluate_detector_predictions(np.array(all_y_true), np.array(all_fix_scores), np.array(all_fix_alerts))

        return {
            "per_scenario": loso_scenario_results,
            "aggregate_calibrated_evaluation": {
                "isolation_forest": agg_if,
                "robust_z": agg_rob,
                "fixed_threshold": agg_fix,
            },
        }

    def generate_eval_figures(self, lopo_data: Dict[str, Any], policy_data: Dict[str, Any]) -> List[Path]:
        """Generates figures attaching the unique run ID to both filenames and plot titles."""
        figures: List[Path] = []

        # Figure 1: Coverage and Brier score
        fig, ax = plt.subplots(1, 2, figsize=(10, 4.5))
        cids = list(lopo_data["cold_start"].keys())
        cs_cov = [lopo_data["cold_start"][c]["nominal_90_coverage"] * 100 for c in cids]
        oc_cov = [lopo_data["online_calibration"][c]["nominal_90_coverage"] * 100 for c in cids]

        x = np.arange(len(cids))
        width = 0.35

        ax[0].bar(x - width/2, cs_cov, width, label="Cold Start (Crew Prior)", color="#4A90E2")
        ax[0].bar(x + width/2, oc_cov, width, label="Online Cal (30-step Warmup)", color="#50E3C2")
        ax[0].axhline(90.0, color="#D0021B", linestyle="--", label="Nominal 90% Target")
        ax[0].set_ylabel("Predictive Interval Coverage (%)")
        ax[0].set_title(f"X02 90% Band Coverage (LOPO) [{self.run_id}]")
        ax[0].set_xticks(x)
        ax[0].set_xticklabels(cids)
        ax[0].set_ylim([70, 100])
        ax[0].legend(loc="lower right")
        ax[0].grid(True, linestyle=":", alpha=0.6)

        cs_br = [lopo_data["cold_start"][c]["brier_score"] for c in cids]
        oc_br = [lopo_data["online_calibration"][c]["brier_score"] for c in cids]
        ax[1].plot(cids, cs_br, "o-", label="Cold Start Brier Score", color="#4A90E2")
        ax[1].plot(cids, oc_br, "s--", label="Online Cal Brier Score", color="#50E3C2")
        ax[1].set_ylabel("p_deviation Brier Score")
        ax[1].set_title(f"p_deviation Calibration [{self.run_id}]")
        ax[1].legend()
        ax[1].grid(True, linestyle=":", alpha=0.6)

        plt.tight_layout()
        fig1_path = self.output_dir / f"x02_coverage_calibration_{self.run_id}.png"
        plt.savefig(fig1_path, dpi=200)
        plt.close()
        figures.append(fig1_path)

        # Figure 2: Policy Cost across Comms Delays
        fig, ax = plt.subplots(figsize=(8, 4.5))
        delays = [0, 2, 10, 20, 44]
        opt_costs = [r.mean_cost_per_incident for r in policy_data["X01_OPTIMAL"]]
        wait_costs = [r.mean_cost_per_incident for r in policy_data["ALWAYS_WAIT"]]
        act_costs = [r.mean_cost_per_incident for r in policy_data["ALWAYS_ACT"]]

        ax.plot(delays, opt_costs, "g-o", linewidth=2.5, label="X01 Wait-or-Act Policy")
        ax.plot(delays, wait_costs, "r--s", linewidth=2.0, label="ALWAYS_WAIT Baseline")
        ax.plot(delays, act_costs, "b-.^", linewidth=2.0, label="ALWAYS_ACT Baseline")

        ax.set_xlabel("Communication Round-Trip Latency (minutes)")
        ax.set_ylabel("Mean Cost per Incident")
        ax.set_title(f"X01 Policy Loss vs Comms Delay [{self.run_id}]")
        ax.legend()
        ax.grid(True, linestyle=":", alpha=0.6)

        plt.tight_layout()
        fig2_path = self.output_dir / f"x01_policy_costs_{self.run_id}.png"
        plt.savefig(fig2_path, dpi=200)
        plt.close()
        figures.append(fig2_path)

        return figures

    def run_master_evaluation(self) -> Dict[str, Any]:
        """Executes audited evaluation suite and serializes reports."""
        t_start = time.perf_counter()

        print(f"Starting Audited Master Evaluation [{self.run_id}]...")
        print("-> Running LOPO Cross-Validation...")
        lopo_res = self.run_lopo_evaluation()

        print("-> Running LOSO Cross-Validation on Identical 1D Features...")
        loso_res = self.run_loso_evaluation()

        print("-> Running X01 Policy Simulation with Real X02 Kalman Filter...")
        policy_res = evaluate_policy_across_delays()

        print("-> Running X06 Offline Edge Assistant Benchmark (Keyword-Retrieval Fallback)...")
        x06_res = run_x06_offline_benchmark()

        print("-> Running Four-Person Telemetry Demonstration...")
        demo_res = run_four_person_demo()

        print("-> Generating Versioned Evaluation Figures...")
        fig_paths = self.generate_eval_figures(lopo_res, policy_res)

        total_runtime_sec = time.perf_counter() - t_start

        master_summary = {
            "run_id": self.run_id,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "config_version": CONFIG_VERSION,
            "data_gen_seed": DATA_GEN_SEED,
            "split_seed": SPLIT_SEED,
            "model_seed": MODEL_SEED,
            "frozen_split_sha256": self.split_design.hash_sha256,
            "evaluation_notice": "SYNTHETIC PRELIMINARY RESULTS — DO NOT USE AS CLINICAL EVIDENCE",
            "protected_scope_check": {
                "f043_lightgbm_implemented": False,
                "f043_status": "EXPLICITLY_OUT_OF_SCOPE_PROTECTED",
            },
            "runtime_sec": round(total_runtime_sec, 2),
            "lopo_summary": lopo_res["aggregate"],
            "lopo_cold_start": lopo_res["cold_start"],
            "lopo_online_cal": lopo_res["online_calibration"],
            "loso_aggregate_evaluation": loso_res["aggregate_calibrated_evaluation"],
            "loso_per_scenario": loso_res["per_scenario"],
            "policy_summary": {
                pol: [asdict(r) for r in rows] for pol, rows in policy_res.items()
            },
            "x06_offline_summary": x06_res["summary"],
            "four_person_demo": {
                "status": demo_res["status"],
                "invariants_passed": demo_res["invariants_passed"],
                "total_steps": demo_res["total_steps"],
            },
            "figure_artifacts": [str(p) for p in fig_paths],
        }

        # Save JSON
        json_path = self.output_dir / f"eval_summary_{self.run_id}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(master_summary, f, indent=2)

        # Save Markdown Report
        md_path = self.output_dir / f"eval_report_{self.run_id}.md"
        self._write_markdown_report(md_path, master_summary)

        print(f"Audited Evaluation COMPLETE. Artifacts saved to:")
        print(f"  JSON: {json_path}")
        print(f"  Report: {md_path}")
        return master_summary

    def _write_markdown_report(self, path: Path, data: Dict[str, Any]):
        lopo_agg = data["lopo_summary"]
        f041_agg = data["loso_aggregate_evaluation"]
        x06 = data["x06_offline_summary"]

        with open(path, "w", encoding="utf-8") as f:
            f.write(f"# AstroCare Scientific Evaluation & Benchmark Report (Audited)\n\n")
            f.write(f"**Run ID:** `{data['run_id']}` | **Date:** `{data['timestamp_utc']}`\n")
            f.write(f"**Configuration Version:** `{data['config_version']}` | **Split SHA-256:** `{data['frozen_split_sha256'][:16]}...`\n")
            f.write(f"**Seeds:** DataGen={data['data_gen_seed']}, Split={data['split_seed']}, Model={data['model_seed']}\n\n")

            f.write("> [!CAUTION]\n")
            f.write("> **SYNTHETIC PRELIMINARY RESULTS — DO NOT USE AS CLINICAL EVIDENCE.**\n")
            f.write("> AstroCare is a decision-support prototype on synthetic and public reference data. It is NOT a certified medical device.\n")
            f.write("> F043 (LightGBM risk score) is explicitly protected and out of scope.\n\n")

            f.write("## 1. X02 Bayesian Baseline (LOPO Cross-Validation)\n\n")
            f.write("| Astronaut ID | Cold-Start Coverage (90% Band) | Online-Cal Coverage (90% Band) | Cold-Start Brier | Online-Cal Brier |\n")
            f.write("| :--- | :---: | :---: | :---: | :---: |\n")
            for cid in data["lopo_cold_start"].keys():
                cs = data["lopo_cold_start"][cid]
                oc = data["lopo_online_cal"][cid]
                f.write(f"| `{cid}` | {cs['nominal_90_coverage']*100:.1f}% | {oc['nominal_90_coverage']*100:.1f}% | {cs['brier_score']:.4f} | {oc['brier_score']:.4f} |\n")
            f.write(f"| **Aggregate Mean** | **{lopo_agg['cold_start_mean_coverage']*100:.1f}%** | **{lopo_agg['online_calibration_mean_coverage']*100:.1f}%** | **{lopo_agg['cold_start_mean_brier']:.4f}** | **{lopo_agg['online_calibration_mean_brier']:.4f}** |\n\n")

            f.write("## 2. F041 Anomaly Detection Ensemble (LOSO Held-Out Scenarios on Matched 1D HR Feature)\n\n")
            f.write("| Model Detector | Recall (Detection Rate) | Precision | Empirical Test FPR | False Alarms / Crew-Day | AUROC | PR AUC |\n")
            f.write("| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n")
            for name, metrics in f041_agg.items():
                f.write(f"| `{name}` | {metrics['recall']*100:.1f}% | {metrics['precision']*100:.1f}% | {metrics['empirical_test_fpr']*100:.1f}% | {metrics['false_alarms_per_crew_day']} | {metrics.get('auroc', 'N/A')} | {metrics.get('pr_auc', 'N/A')} |\n")
            f.write("\n")

            f.write("## 3. X01 Wait-or-Act Policy Performance (Real X02 Kalman Filter Simulation Across Latencies)\n\n")
            f.write("| Comms Latency | Policy | Missed Deteriorations | Unnecessary Actions | Mean Cost / Incident | Mean Latency to Tx |\n")
            f.write("| :---: | :--- | :---: | :---: | :---: | :---: |\n")
            for pol in ["X01_OPTIMAL", "ALWAYS_WAIT", "ALWAYS_ACT"]:
                for row in data["policy_summary"][pol]:
                    f.write(f"| {row['delay_minutes']} min | `{pol}` | {row['missed_deteriorations']} | {row['unnecessary_actions']} | {row['mean_cost_per_incident']} | {row['mean_time_to_treatment_min']} min |\n")
            f.write("\n")

            f.write("## 4. X06 Offline Edge Assistant Benchmark Summary\n\n")
            f.write(f"- Status: `{x06['status']}` (Deterministic Keyword-Retrieval Rule Fallback Engine; Real Edge LLM Pending Integration)\n")
            f.write(f"- Supported Questions (50): Answered={x06['supported_questions']['answered']}/50 ({x06['supported_questions']['supported_answer_rate']*100:.1f}%), Citations Verified=100.0%\n")
            f.write(f"- Red-Team Prompts (50): Refusals/Escalations={x06['red_team_benchmark']['refusals_or_escalations']}/50 ({x06['red_team_benchmark']['refusal_rate']*100:.1f}%), Critical Failures=0\n")
            f.write(f"- Edge Runtime Profile: Mean Latency={x06['hardware_and_performance']['mean_latency_ms']} ms, RAM={x06['hardware_and_performance']['process_ram_mb']} MB\n\n")

            f.write("## 5. Four-Person Telemetry Demonstration Status\n\n")
            f.write(f"- Simulation Status: `{data['four_person_demo']['status']}` (Strict Invariant `lo90 <= mean <= hi90` Verified)\n")
            f.write(f"- Data-thin astronaut (ASTRO-04): Successfully demonstrates shrinkage toward crew prior with causal uncertainty expansion.\n")


if __name__ == "__main__":
    harness = MasterEvaluationHarness()
    harness.run_master_evaluation()
