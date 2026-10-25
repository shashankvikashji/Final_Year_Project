"""
Chemical-only YOLO training.

Strategy (as requested): keep the existing 6-class model FROZEN/UNTOUCHED
(backend/best.pt) and train a SECOND single-class model for chemical waste.

  base model (frozen, never overwritten): backend/best.pt
      -> classes: electronic, glass, metal, organic, paper, plastic
  new model (this script trains): backend/best_chemical.pt
      -> classes: [chemical]

How it preserves the 6 old classes:
  1. Starts from backend/best.pt weights (backbone already knows waste features).
  2. freeze=10 freezes the backbone, only the detection head learns chemical.
  3. single_cls=True so every label file must use class "0".
  4. At inference, waste_detector.py runs BOTH models and merges results.

Usage:
  1. Put labelled images under waste_training/chemical_dataset/ (see chemical_data.yaml).
  2. python waste_training/train_chemical.py [--epochs 50] [--batch 8] [--imgsz 640]
  3. New weights -> backend/best_chemical.pt (auto-copied).

Needs ~200+ chemical images minimum (400+ recommended) for a usable detector.
"""
import argparse
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent          # waste_training/
ROOT = HERE.parent                              # project root
BASE_MODEL = ROOT / "backend" / "best.pt"       # frozen 6-class model (never overwritten)
DATA_YAML = HERE / "chemical_data.yaml"
CHEM_DATASET = HERE / "chemical_dataset"


def check_dataset():
    train_img = CHEM_DATASET / "train" / "images"
    valid_img = CHEM_DATASET / "valid" / "images"
    train_imgs = list(train_img.glob("*.*")) if train_img.exists() else []
    train_imgs = [p for p in train_imgs if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".webp")]
    valid_imgs = list(valid_img.glob("*.*")) if valid_img.exists() else []
    valid_imgs = [p for p in valid_imgs if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".bmp", ".webp")]
    return train_imgs, valid_imgs


def main():
    ap = argparse.ArgumentParser(description="Train chemical-only waste detector")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--device", default="cpu", help="cpu or 0 for first GPU")
    ap.add_argument("--workers", type=int, default=0, help="0 avoids Windows multiprocessing issues")
    args = ap.parse_args()

    if not BASE_MODEL.exists():
        print(f"ERROR: base model not found: {BASE_MODEL}")
        print("Keep backend/best.pt in place - it is your frozen 6-class model.")
        sys.exit(1)

    train_imgs, valid_imgs = check_dataset()
    print(f"Chemical dataset: {len(train_imgs)} train / {len(valid_imgs)} valid images")
    if len(train_imgs) < 20:
        print()
        print("NOT ENOUGH CHEMICAL DATA.")
        print(f"Put YOLO-labelled images in: {CHEM_DATASET}/train/images + labels/")
        print(f"and: {CHEM_DATASET}/valid/images + labels/")
        print("See waste_training/CHEMICAL_DATASET_GUIDE.md for how to collect + label.")
        print("Need at least 20 images to smoke-test, 200+ for real use.")
        sys.exit(2)

    from ultralytics import YOLO

    model = YOLO(str(BASE_MODEL))  # start from 6-class weights, backbone knows waste
    print(f"Loaded base weights: {BASE_MODEL} (classes: {model.names})")
    print("Training chemical head with backbone frozen (freeze=10, single_cls=True)...")

    results = model.train(
        data=str(DATA_YAML),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
        workers=args.workers,
        project=str(HERE / "runs" / "detect"),
        name="train_chemical",
        exist_ok=True,
        pretrained=True,
        single_cls=True,   # all labels are class 0 = chemical
        freeze=10,         # freeze backbone -> preserves 6-class features
        patience=20,
        cos_lr=True,
        close_mosaic=10,
        val=True,
    )

    # Best weights from this run
    best = HERE / "runs" / "detect" / "train_chemical" / "weights" / "best.pt"
    dest = ROOT / "backend" / "best_chemical.pt"
    if best.exists():
        shutil.copy(best, dest)
        print(f"\nSaved chemical model -> {dest}")
        print("backend/best.pt was NOT touched (your 6 classes are intact).")
    else:
        print(f"\nWARNING: expected weights not found at {best}")

    # Quick validation summary
    try:
        metrics = model.val(data=str(DATA_YAML))
        print(f"mAP50-95: {metrics.box.map:.3f}  mAP50: {metrics.box.map50:.3f}")
    except Exception as e:
        print(f"val summary skipped: {e}")


if __name__ == "__main__":
    main()
