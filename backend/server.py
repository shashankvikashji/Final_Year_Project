from dotenv import load_dotenv
from pathlib import Path
from ml.waste_detector import detect_waste
from fastapi import FastAPI


# your existing imports...

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import json
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr



logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("wastrix")

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
ROLES = ("citizen", "ngo", "municipality")
PRIORITIES = ("low", "medium", "high", "critical")
STATUSES = ("reported", "in-progress", "resolved")

# auto_error=False so a missing Authorization header is handled in get_current_user,
# which returns 401 (the correct code for "not authenticated") instead of the 403
# that HTTPBearer raises by default.
security = HTTPBearer(auto_error=False)

app = FastAPI(
    title="Wastrix",
    description="AI-Driven Civic Waste Triage & Priority-Aging Dispatch Engine"
)
api = APIRouter(prefix="/api")


# ---------- models ----------
class BaseDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    def to_mongo(self) -> dict:
        doc = self.model_dump()
        doc["_id"] = doc.pop("id")
        return doc

    @classmethod
    def from_mongo(cls, doc: dict):
        if doc is None:
            return None
        data = dict(doc)
        data["id"] = str(data.pop("_id"))
        return cls(**data)


class User(BaseDocument):
    name: str
    email: str
    role: Literal["citizen", "ngo", "municipality"]
    password_hash: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Report(BaseDocument):
    photo_url: str
    lat: float
    lng: float
    description: str
    status: Literal["reported", "in-progress", "resolved"] = "reported"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    priority_score: float = 50.0
    ai_rationale: str = ""
    reporter_id: str
    reporter_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["citizen", "ngo", "municipality"]


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ReportBody(BaseModel):
    photo_url: str
    lat: float
    lng: float
    description: str


class StatusBody(BaseModel):
    status: Literal["reported", "in-progress", "resolved"]


# ---------- auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def public_user(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc["name"], "email": doc["email"], "role": doc["role"]}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated. Sign in to continue."
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            os.environ["JWT_SECRET"],
            algorithms=[JWT_ALGORITHM]
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Your session expired. Sign in again."
        )

    except jwt.InvalidTokenError as e:
        print("JWT ERROR:", repr(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid session token."
        )

    doc = await db.users.find_one({"_id": payload["sub"]})

    if not doc:
        raise HTTPException(
            status_code=401,
            detail="Account no longer exists."
        )

    return doc


async def require_crew(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in ("ngo", "municipality"):
        raise HTTPException(status_code=403, detail="Only NGO and municipality accounts can change report status.")
    return user


# ---------- AI priority scoring ----------

def score_priority(
    detections,
    description: str,
    lat: float,
    lng: float
) -> tuple:
    """
    Calculate numerical waste priority score.

    Formula:
        P = 0.40*S + 0.25*C + 0.20*Q + 0.15*L

        S = Severity Score
        C = YOLO Confidence Score
        Q = Quantity Score
        L = Location Risk Score
    """

    # ---------------------------------------------------------
    # No YOLO detection
    # ---------------------------------------------------------
    if not detections:
        return (
            50.0,
            "medium",
            "No recognizable waste objects were detected. Manual crew review is recommended."
        )

    # ---------------------------------------------------------
    # 1. SEVERITY SCORE
    # ---------------------------------------------------------

    severity_map = {
        "chemical": 100,
        "electronic": 100,
        "organic": 80,
        "metal": 65,
        "glass": 60,
        "plastic": 50,
        "paper": 35,
    }

    detected_classes = [
        detection["class"].lower()
        for detection in detections
    ]

    severity_scores = [
        severity_map.get(waste_class, 50)
        for waste_class in detected_classes
    ]

    # Highest severity waste determines severity
    severity = max(severity_scores)

    # ---------------------------------------------------------
    # 2. YOLO CONFIDENCE SCORE
    # ---------------------------------------------------------

    confidence_values = [
        float(detection["confidence"])
        for detection in detections
    ]

    # Average confidence × 100
    confidence = (
        sum(confidence_values) / len(confidence_values)
    ) * 100

    # ---------------------------------------------------------
    # 3. QUANTITY SCORE
    # ---------------------------------------------------------

    quantity = len(detections)

    if quantity == 1:
        quantity_score = 25
    elif quantity == 2:
        quantity_score = 50
    elif quantity == 3:
        quantity_score = 75
    else:
        quantity_score = 100

    # ---------------------------------------------------------
    # 4. LOCATION RISK SCORE
    # ---------------------------------------------------------

    # Baseline location risk for the current implementation.
    # This can later be replaced with real location-risk data.
    location_risk = 40

    # ---------------------------------------------------------
    # 5. FINAL NUMERICAL SCORE
    # ---------------------------------------------------------

    priority_score = (
        (0.40 * severity)
        + (0.25 * confidence)
        + (0.20 * quantity_score)
        + (0.15 * location_risk)
    )

    priority_score = round(priority_score, 2)

    # ---------------------------------------------------------
    # 6. PRIORITY LEVEL
    # ---------------------------------------------------------

    if priority_score >= 80:
        priority = "critical"

    elif priority_score >= 60:
        priority = "high"

    elif priority_score >= 40:
        priority = "medium"

    else:
        priority = "low"

    # ---------------------------------------------------------
    # 7. RATIONALE
    # ---------------------------------------------------------

    detected = ", ".join(sorted(set(detected_classes)))

    rationale = (
        f"Waste detected: {detected}. "
        f"Priority score: {priority_score}/100 "
        f"(severity={severity}, "
        f"confidence={round(confidence, 1)}, "
        f"quantity={quantity_score}, "
        f"location={location_risk})."
    )

    return (
        priority_score,
        priority,
        rationale
    )
       
# ---------- auth routes ----------
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = body.email.lower().strip()
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account already exists with this email. Sign in instead.")
    user = User(name=body.name.strip(), email=email, role=body.role, password_hash=hash_password(body.password))
    await db.users.insert_one(user.to_mongo())
    return {"token": create_access_token(user.id, email),
            "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role}}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.lower().strip()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="That email and password don't match an account.")
    return {"token": create_access_token(str(doc["_id"]), email), "user": public_user(doc)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


# ---------- report routes ----------
LIST_FIELDS = {"photo_url": 0}


def serialize(doc: dict) -> dict:
    data = dict(doc)
    data["id"] = str(data.pop("_id"))
    return data


@api.get("/public/reports")
async def public_reports():
    docs = await db.reports.find({}, LIST_FIELDS).sort("created_at", -1).to_list(200)
    return [serialize(d) for d in docs]


@api.post("/reports")
async def create_report(body: ReportBody, user: dict = Depends(get_current_user)):

    if not body.photo_url:
        raise HTTPException(
            status_code=400,
            detail="A photo is required — crews need to see the waste before dispatch."
        )

    # YOLO waste/object detection
    detections = detect_waste(body.photo_url)

    # Calculate priority from YOLO detections
    priority_score, priority, rationale = score_priority(
    detections,
    body.description,
    body.lat,
    body.lng
  )

    report = Report(
    photo_url=body.photo_url,
    lat=body.lat,
    lng=body.lng,
    description=body.description.strip(),
    priority=priority,
    priority_score=priority_score,
    ai_rationale=rationale,
    reporter_id=str(user["_id"]),
    reporter_name=user["name"],
)

    await db.reports.insert_one(report.to_mongo())

    return {
        **report.model_dump(),
        "detections": detections
    }


@api.get("/reports")
async def list_reports(user: dict = Depends(get_current_user)):
    query = {"reporter_id": str(user["_id"])} if user["role"] == "citizen" else {}
    docs = await db.reports.find(query, LIST_FIELDS).sort("created_at", -1).to_list(500)
    return [serialize(d) for d in docs]


@api.get("/reports/{report_id}")
async def get_report(report_id: str, user: dict = Depends(get_current_user)):
    doc = await db.reports.find_one({"_id": report_id})
    if not doc:
        raise HTTPException(status_code=404, detail="That report no longer exists.")
    if user["role"] == "citizen" and doc["reporter_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="You can only open reports you filed.")
    return serialize(doc)


@api.patch("/reports/{report_id}/status")
async def update_status(report_id: str, body: StatusBody, user: dict = Depends(require_crew)):
    result = await db.reports.update_one({"_id": report_id}, {"$set": {"status": body.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="That report no longer exists.")
    doc = await db.reports.find_one({"_id": report_id}, LIST_FIELDS)
    return serialize(doc)


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


SEED_USERS = [
    ("Priya Raman", "citizen@smartwaste.app", "citizen", "waste1234"),
    ("Clean Streets Collective", "ngo@smartwaste.app", "ngo", "waste1234"),
    ("Ward 4 Sanitation Office", "muni@smartwaste.app", "municipality", "waste1234"),
]

# Demonstration ward data for the intended deployment city (Ghaziabad, Uttar Pradesh).
# These are SYNTHETIC sample records for demo purposes, not real incidents — the
# coordinates are plausible neighbourhood points around the city centre, and the
# descriptions are generic. Real reports filed through the app keep their own
# coordinates untouched.
#
# (lat, lng, description, priority, ai_rationale, status, photo_url)
SEED_REPORTS = [
    (28.6692, 77.4538, "Construction debris and paint tins dumped at the alley mouth, blocking the drain grate.",
     "critical", "Chemical containers beside a blocked storm drain create a runoff and flooding hazard.",
     "in-progress", "https://images.unsplash.com/photo-1759401654832-ab2e73a14336?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
    (28.6741, 77.4602, "Overflowing bins outside the market, bags torn open by animals overnight.",
     "high", "Large uncontained pile next to a food market with visible scavenging damage.",
     "reported", "https://images.unsplash.com/photo-1762805545352-4ac5355b0f0b?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
    (28.6605, 77.4487, "Household bags left on the footpath two days after collection day.",
     "medium", "Moderate bagged household waste narrowing the footpath but not blocking it.",
     "reported", "https://images.unsplash.com/photo-1759401654832-ab2e73a14336?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
    (28.6812, 77.4702, "Scattered bottles and wrappers along the park railing.",
     "low", "Light scattered litter with no hazard or obstruction.",
     "resolved", "https://images.unsplash.com/photo-1762805545352-4ac5355b0f0b?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
    (28.6885, 77.4136, "Someone is burning a waste pile behind the bus depot, thick smoke across the road.",
     "critical", "Active open burning of mixed waste producing smoke over a public road.",
     "reported", "https://images.unsplash.com/photo-1759401654832-ab2e73a14336?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
    (28.7021, 77.4361, "Broken glass and a discarded mattress at the corner of the school lane.",
     "high", "Sharp glass debris directly on a route used by schoolchildren.",
     "in-progress", "https://images.unsplash.com/photo-1762805545352-4ac5355b0f0b?crop=entropy&cs=srgb&fm=jpg&w=900&q=70"),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.reports.create_index("reporter_id")

    citizen_id = None
    for name, email, role, password in SEED_USERS:
        existing = await db.users.find_one({"email": email})
        if existing is None:
            user = User(name=name, email=email, role=role, password_hash=hash_password(password))
            await db.users.insert_one(user.to_mongo())
            uid = user.id
        else:
            uid = str(existing["_id"])
        if role == "citizen":
            citizen_id = uid

    if await db.reports.count_documents({}) == 0 and citizen_id:
        now = datetime.now(timezone.utc)
        for i, (lat, lng, desc, priority, rationale, status, photo) in enumerate(SEED_REPORTS):
            report = Report(
                photo_url=photo, lat=lat, lng=lng, description=desc, status=status,
                priority=priority, ai_rationale=rationale,
                reporter_id=citizen_id, reporter_name="Priya Raman",
                created_at=(now - timedelta(hours=6 * (i + 1))).isoformat(),
            )
            await db.reports.insert_one(report.to_mongo())


@app.on_event("shutdown")
async def shutdown():
    client.close()

