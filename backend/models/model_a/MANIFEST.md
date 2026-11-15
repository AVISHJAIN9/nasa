# AstroCare ML1 inference bundle

## Contents and model selection

This is the registered `wesad_wrist_stress_classifier` (`stress-v1`, 2026-11-08). Its registry selects logistic regression. The original training script compares random forest and logistic regression by leave-one-subject-out balanced accuracy, selects logistic regression (0.8971475539590246 vs. 0.8755761210386922), then fits it on the complete derived table. This matches the project summary's reported best WESAD stress results: AUROC 0.953840 and balanced accuracy 0.897148.

The other stress-like artifact, `hrv_stress_model.joblib`, reports balanced accuracy 0.7514277451368383 and macro-F1 0.6941372868205835. It does not match the reported best results and is excluded. No epoch checkpoints, optimizer/scheduler state, raw subject pickle, or training arrays are included.

## Input contract

The selected estimator accepts **eight** features, not 169. No 169-feature workbook/schema was found in the project scan. Its `stress_features.json`, training code, and inference code consistently define the eight inputs below. A 169-column workbook cannot be passed to this estimator without a separate documented transformation/model, which this project does not contain.

One row represents a 60-second wrist-signal window. Definitions follow the source feature extraction code. Observed min/max below are from the project's derived WESAD table; they are descriptive only, not safe limits or physiological reference ranges.

| Order | Feature | Meaning and unit | Observed min–max |
|---:|---|---|---:|
| 1 | `hr_mean` | Mean pulse rate, beats/min | 50.485645–131.464968 |
| 2 | `sdnn` | SD of inter-beat intervals, ms | 28.900863–482.839898 |
| 3 | `rmssd` | Root mean square of successive interval differences, ms | 19.906939–585.612338 |
| 4 | `pnn50` | Share of successive interval differences over 50 ms, percent | 1.449275–98.305085 |
| 5 | `eda_mean` | Mean wrist electrodermal activity, µS | 0.094317–15.611939 |
| 6 | `eda_std` | Standard deviation of wrist electrodermal activity, µS | 0.000915–1.348292 |
| 7 | `eda_slope` | Linear EDA slope over 4 Hz sample index, µS/sample | -0.005530–0.018669 |
| 8 | `temp_mean` | Mean wrist skin temperature, °C | 29.031667–35.928000 |

Feature order is exactly the order above and in `models/stress_features.json`.

## Preprocessing and output

The sklearn pipeline includes median imputation, standard scaling, and logistic regression. No separate calibration object or selected operating threshold is stored. `stress_probability` is the class-1 probability. The label follows the project's existing argmax behavior: `stressed` or `not_stressed`.

`ml1_stress.inference.predict` accepts a pandas DataFrame or one feature dictionary and returns `stress_probability` and `label`. Run `python predict.py sample_input.csv`. The two sample rows are hand-authored synthetic examples, not rows copied from WESAD or an individual.

## Reported validation results (copied, not recomputed)

`F146_MODEL_SUMMARY.md` records 1,377 WESAD derived windows from 15 subjects, evaluated by leave-one-subject-out (LOSO): AUROC **0.953840**, balanced accuracy **0.897148**. `F147_RESEARCH_REPORT.md` records the HR > 90 bpm baseline AUROC **0.729481**, and model balanced accuracy **0.897148** versus baseline balanced accuracy **0.560941**. These are laboratory dataset results, not clinical or astronaut performance.

The selected-model registry records logistic regression balanced accuracy **0.8971475539590246**, accuracy **0.8888888888888888**, stress F1 **0.7854137447405329**, confusion matrix `[[944, 126], [27, 280]]`. Random-forest candidate: balanced accuracy **0.8755761210386922**, accuracy **0.896877269426289**, stress F1 **0.7835365853658537**, confusion matrix `[[978, 92], [50, 257]]`. Candidate AUROC, precision/recall, calibration metrics, and a validated probability threshold: **not recorded**. The summary AUROC is copied as reported; it was not recomputed during packaging.

## Data, split, and limitations

Training source: WESAD wrist BVP, EDA, and temperature. The feature script uses 60-second windows with 30-second stride, retains windows with at least 90% one label, and maps WESAD label 2 to stressed and labels 1, 3, 4 to not-stressed. Validation holds one subject out at a time across 15 subjects. The production estimator is then fitted on all 1,377 derived windows.

WESAD is a small laboratory cohort, not astronaut or clinical data; subjects and protocol may not represent deployment users. The classifier estimates labels derived from the study protocol. Probability calibration was not recorded. The model does not consume a 169-feature workbook or raw waveform; it requires already-computed eight-feature windows. Source access terms say scientific non-commercial use with attribution; verify current terms before redistribution or commercial use.

## Shrink verification

The registered estimator was saved with joblib compression level 3. Original and compressed class probabilities were compared on synthetic `sample_input.csv`; the check and maximum absolute difference are printed during bundle creation. The CLI was also run after extraction into a clean temporary directory with pinned requirements installed.

## Bundle file inventory

Sizes are uncompressed bytes. This inventory includes this manifest.

| File | Size (bytes) |
|---|---:|
| `MANIFEST.md` | 5812 |
| `TRAIN_RECIPE.md` | 2528 |
| `ml1_stress/__init__.py` | 57 |
| `ml1_stress/inference.py` | 1525 |
| `models/stress_features.json` | 220 |
| `models/stress_model.joblib` | 1395 |
| `models/stress_model_registry.json` | 1006 |
| `predict.py` | 624 |
| `requirements.txt` | 65 |
| `sample_input.csv` | 153 |
