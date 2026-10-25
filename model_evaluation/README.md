# Model Evaluation Package — Wastrix YOLOv8n

Final evaluation of the deployed waste-detection model, executed on the **held-out test split**.

## Headline result

| Metric | Value | Target | Met |
|---|---:|---:|:--:|
| mAP@50 | 0.633 | >0.80 | ✗ |
| mAP@50–95 | 0.411 | >0.50 | ✗ |
| Precision | 0.525 | >0.85 | ✗ |
| Recall | 0.698 | >0.80 | ✗ |
| F1 | 0.599 | >0.80 | ✗ |

Read `evaluation_report.md` for the full analysis before citing these numbers.

## Contents

| File | Description |
|---|---|
| `evaluation_report.md` | Full evaluation report (13 sections) |
| `metrics_summary.csv` | Overall metrics vs targets, test split |
| `per_class_metrics.csv` | Per-class P/R/mAP50/mAP50-95/F1, plus operating-point block |
| `confidence_threshold_results.csv` | **Validation** threshold sweep (0.05–0.90) |
| `test_operating_points.csv` | Test-split operating points (reporting only) |
| `evaluation_config.json` | Full reproducibility record |
| `test_split_results.csv` | Raw Ultralytics per-epoch val output |
| `graphs/` | All diagnostic graphs |

## Graphs

| File | Source |
|---|---|
| `confusion_matrix.png` | test split |
| `confusion_matrix_normalized.png` | test split |
| `BoxPR_curve.png` | test split |
| `BoxF1_curve.png` | test split |
| `BoxP_curve.png` | test split |
| `BoxR_curve.png` | test split |
| `val_confusion_matrix.png` / `_normalized.png` | valid split |
| `val_PR_curve.png`, `val_F1_curve.png`, `val_P_curve.png`, `val_R_curve.png` | valid split |
| `loss_curves.png` | training history (`results.csv`) |
| `training_metrics.png` | training history (`results.csv`) |

## Protocol

- Threshold **tuning** used the **validation** split only.
- Final **reporting** used the **test** split, untouched during tuning.
- mAP figures use the standard `conf=0.001` confidence sweep.
- Operating-point figures (`conf=0.25`) are reported separately.
- Seed 0 throughout.

## Two critical caveats

1. **The 0.896 mAP50 in `results.csv` is a validation figure, not test.** Test mAP50 is
   **0.633**. Cite 0.633 in the project report.
2. **97.6% of dataset annotations are segmentation polygons, not bounding boxes**, but the
   model is trained/evaluated as `detect`. See report §10.

## Not evaluated

**Chemical class is absent.** The deployed model has 6 classes; no 7-class model exists, so
no chemical metrics exist. The candidate chemical data on disk was found to depict polluted
water bodies, not chemical containers.
