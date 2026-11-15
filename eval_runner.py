"""AstroCare Evaluation Entry Point (`python -m eval_runner` or `make eval`)."""
import sys
from pathlib import Path

# Ensure package root is in sys.path
repo_root = Path(__file__).resolve().parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from astrocare.evaluation.harness import MasterEvaluationHarness
from astrocare.evaluation.report_generator import generate_f147_report


def main():
    harness = MasterEvaluationHarness()
    results = harness.run_master_evaluation()
    json_path = harness.output_dir / f"eval_summary_{results['run_id']}.json"
    f147_path = generate_f147_report(json_path)

    print("\n=======================================================")
    print(f"Master Evaluation Finished. Run ID: {results['run_id']}")
    print(f"LOPO Mean 90% Coverage: {results['lopo_summary']['cold_start_mean_coverage']*100:.1f}%")
    print(f"F041 Isolation Forest AUROC: {results['loso_aggregate_evaluation']['isolation_forest']['auroc']}")
    print(f"X06 Offline Status: {results['x06_offline_summary']['status']}")
    print(f"F147 Research Report: {f147_path}")
    print("=======================================================\n")


if __name__ == "__main__":
    main()
