from ultralytics import YOLO
import os
import base64
import tempfile


MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "best.pt"
)

# Second model: chemical-only detector trained via waste_training/train_chemical.py.
# Kept as a separate file so backend/best.pt (6 classes) is never overwritten.
CHEMICAL_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "best_chemical.pt"
)

model = YOLO(MODEL_PATH)

chemical_model = None
if os.path.exists(CHEMICAL_MODEL_PATH):
    try:
        chemical_model = YOLO(CHEMICAL_MODEL_PATH)
        print(f"Chemical model loaded: {CHEMICAL_MODEL_PATH} classes={chemical_model.names}")
    except Exception as e:
        print(f"Chemical model load failed ({CHEMICAL_MODEL_PATH}): {e}")
        chemical_model = None
else:
    print(f"No chemical model at {CHEMICAL_MODEL_PATH} - running 6-class model only.")


def _predict_to_detections(yolo_model, image_path, conf=0.25, fixed_label=None):
    out = []
    results = yolo_model.predict(source=image_path, conf=conf, verbose=False)
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            # Chemical model is single-class: label everything "chemical"
            # (single_cls training stores the name as "item", so remap here).
            class_name = fixed_label if fixed_label else yolo_model.names[class_id]
            out.append({
                "class": class_name,
                "confidence": round(confidence, 3)
            })
    return out


def detect_waste(photo_url: str):
    """
    Detect objects from a base64 image.
    Returns detected objects and confidence scores.
    """

    try:
        # Remove data:image/...;base64, prefix
        if photo_url.startswith("data:"):
            image_data = photo_url.split(",", 1)[1]
        else:
            image_data = photo_url

        image_bytes = base64.b64decode(image_data)

        # Create temporary image
        with tempfile.NamedTemporaryFile(
            suffix=".jpg",
            delete=False
        ) as temp:
            temp.write(image_bytes)
            image_path = temp.name

        # Run YOLO (6-class base model, always)
        detections = _predict_to_detections(model, image_path, conf=0.25)

        # Run chemical model too if present, merge results
        if chemical_model is not None:
            try:
                detections += _predict_to_detections(
                    chemical_model, image_path, conf=0.25, fixed_label="chemical"
                )
            except Exception as e:
                print("Chemical detection error:", e)

        os.remove(image_path)

        return detections

    except Exception as e:
        print("YOLO detection error:", e)
        return []