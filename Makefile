# AstroCare Project Makefile
PYTHON ?= python

.PHONY: all eval test demo benchmark splits handoff clean help

all: splits test eval

help:
	@echo "AstroCare Build & Evaluation Suite"
	@echo "  make all        - Generate splits, run tests, and execute master evaluation"
	@echo "  make splits     - Generate and verify frozen LOPO/LOSO evaluation splits"
	@echo "  make test       - Run test suite with pytest"
	@echo "  make eval       - Execute master LOPO/LOSO evaluation harness and save artifacts"
	@echo "  make demo       - Run 4-person live causal telemetry demonstration"
	@echo "  make benchmark  - Run X06 offline verified assistant benchmark"
	@echo "  make handoff    - Run Hour-6 multi-crew Kalman handoff streaming"
	@echo "  make clean      - Clean bytecode caches and runtime scratch artifacts"

splits:
	$(PYTHON) -m astrocare.evaluation.splits

test:
	$(PYTHON) -m pytest tests -v

eval: splits
	$(PYTHON) -m eval_runner

demo:
	$(PYTHON) -m astrocare.benchmarks.demo_four_person

benchmark:
	$(PYTHON) -m astrocare.benchmarks.x06_benchmark

handoff:
	$(PYTHON) -m astrocare.models.x02_bayesian

clean:
	@$(PYTHON) -c "import shutil, glob, os; [shutil.rmtree(p, ignore_errors=True) for p in glob.glob('**/__pycache__', recursive=True) + glob.glob('.pytest_cache')]"

