# AstroCare Project Makefile
PYTHON = python

.PHONY: all eval test demo benchmark splits help

help:
	@echo "AstroCare Build & Evaluation Suite"
	@echo "  make eval       - Execute master LOPO/LOSO evaluation harness and save artifacts"
	@echo "  make test       - Run test suite with pytest"
	@echo "  make demo       - Run 4-person live causal telemetry demonstration"
	@echo "  make benchmark  - Run X06 offline verified assistant benchmark"
	@echo "  make splits     - Generate and verify frozen LOPO/LOSO evaluation splits"

eval:
	$(PYTHON) -m eval_runner

test:
	$(PYTHON) -m pytest tests -v

demo:
	$(PYTHON) -m astrocare.benchmarks.demo_four_person

benchmark:
	$(PYTHON) -m astrocare.benchmarks.x06_benchmark

splits:
	$(PYTHON) -m astrocare.evaluation.splits
