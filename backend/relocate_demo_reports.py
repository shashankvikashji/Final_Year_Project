"""
Relocate SYNTHETIC demo reports from New York coordinates to the intended demo city
(Ghaziabad, Uttar Pradesh).

Scope is deliberately narrow
-----------------------------
Only rows that match the seeded demonstration set are touched:
  * description matches one of the SEED_REPORTS descriptions in server.py, AND
  * the row still sits on the legacy New York bounding box, AND
  * the reporter is the seeded demo citizen.

Genuine user submissions are never modified, even if they happen to sit in New York.
A user really could file a report there; that is their data.

Only `lat` and `lng` are written. _id, description, photo_url, priority, status,
reporter_*, ai_rationale and created_at are all preserved.

Usage
-----
    python relocate_demo_reports.py --dry-run     # report only, writes nothing
    python migrate --apply                        # apply (backs up first)
    python relocate_demo_reports.py --verify      # current state
    python relocate_demo_reports.py --rollback    # restore from backup
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

# Legacy New York bounding box used by the original demo seed.
NY_BOUNDS = {"lat": (40.60, 40.90), "lng": (-74.10, -73.80)}

# Intended demo city, matching frontend/src/config/geo.js DEPLOYMENT.
DEMO_CITY = {
    "Sadar Bazaar": (28.6692, 77.4538),
    "Mohan Nagar": (28.6812, 77.4702),
    "Vaishali": (28.6602, 77.4459),
    "Khekra": (28.7021, 77.4361),
    "Loni border": (28.6885, 77.4136),
}

# Description -> replacement coordinate. Keyed by the exact seeded text so we can
# never touch a row that merely looks similar.
SEED_REPORTS_BY_DESCRIPTION = {
    "Construction debris and paint tins dumped at the alley mouth, blocking the drain grate.": (
        28.6692,
        77.4538,
        "Sadar Bazaar",
    ),
    "Overflowing bins outside the market, bags torn open by animals overnight.": (
        28.6741,
        77.4602,
        "Sadar Bazaar",
    ),
    "Household bags left on the footpath two days after collection day.": (
        28.6605,
        77.4487,
        "Vaishali",
    ),
    "Scattered bottles and wrappers along the park railing.": (
        28.6812,
        77.4702,
        "Mohan Nagar",
    ),
    "Someone is burning a waste pile behind the bus depot, thick smoke across the road.": (
        28.6885,
        77.4136,
        "Loni border",
    ),
    "Broken glass and a discarded mattress at the corner of the school lane.": (
        28.7021,
        77.4361,
        "Khekra",
    ),
}

BACKUP_DIR = HERE / "migrations" / "backups"


def connect():
    uri = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not uri or not db_name:
        sys.exit("ERROR: MONGO_URL / DB_NAME missing from backend/.env")
    client = MongoClient(uri, serverSelectionTimeoutMS=15000)
    client.admin.command("ping")
    return client, client[db_name]


def in_ny(lat, lng):
    return NY_BOUNDS["lat"][0] <= lat <= NY_BOUNDS["lat"][1] and \
        NY_BOUNDS["lng"][0] <= lng <= NY_BOUNDS["lng"][1]


def plan_changes(db):
    """Identify rows to relocate. Returns (changes, skipped)."""
    changes, skipped = [], []

    for doc in db.reports.find({}):
        desc = (doc.get("description") or "").strip()
        lat = doc.get("lat")
        lng = doc.get("lng")

        if desc not in SEED_REPORTS_BY_DESCRIPTION:
            # not a seeded demonstration row -> user data, leave alone
            if in_ny(lat, lng):
                skipped.append((doc, "user submission (description not a seeded demo row)"))
            continue

        new_lat, new_lng, area = SEED_REPORTS_BY_DESCRIPTION[desc]

        if not in_ny(lat, lng):
            skipped.append((doc, f"seeded row already relocated (now {lat}, {lng})"))
            continue

        if abs(lat - new_lat) < 1e-6 and abs(lng - new_lng) < 1e-6:
            skipped.append((doc, "already at target"))
            continue

        changes.append(
            {
                "_id": str(doc["_id"]),
                "description": desc[:58],
                "old": (lat, lng),
                "new": (new_lat, new_lng),
                "area": area,
                "reporter": doc.get("reporter_name"),
                "status": doc.get("status"),
            }
        )

    return changes, skipped


def backup(db) -> Path:
    from bson import ObjectId

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUP_DIR / f"demo_report_coords_{stamp}.json"
    changes, _ = plan_changes(db)
    oids = [ObjectId(c["_id"]) for c in changes]
    docs = list(db.reports.find({"_id": {"$in": oids}})) if oids else []
    payload = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "database": db.name,
        "note": "coordinates only; full documents retained",
        "documents": [{k: (str(v) if k == "_id" else v) for k, v in d.items()} for d in docs],
    }
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    json.loads(path.read_text(encoding="utf-8"))  # verify parseable
    print(f"  backup written -> {path}  ({len(docs)} documents)")
    return path


def latest_backup() -> Path:
    files = sorted(BACKUP_DIR.glob("demo_report_coords_*.json"))
    if not files:
        sys.exit("ERROR: no coordinate backup found; cannot roll back.")
    return files[-1]


def rollback(db):
    import bson

    path = latest_backup()
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"  restoring from {path}")
    n = 0
    for d in data["documents"]:
        oid = bson.ObjectId(d["_id"]) if not isinstance(d["_id"], bson.ObjectId) else d["_id"]
        cur = db.reports.find_one({"_id": oid}, {"lat": 1, "lng": 1})
        if not cur:
            print(f"  - {d['_id']}: missing, skipped")
            continue
        if (cur["lat"], cur["lng"]) == (d["lat"], d["lng"]):
            continue
        db.reports.update_one({"_id": oid}, {"$set": {"lat": d["lat"], "lng": d["lng"]}})
        print(f"  - {d['_id']}: {cur['lat']}, {cur['lng']} -> {d['lat']}, {d['lng']}")
        n += 1
    print(f"  rolled back {n} report(s)")


def show(db):
    print("\n=== report coordinates by cluster ===")
    from collections import Counter

    c = Counter()
    ny_user = 0
    for r in db.reports.find({}, {"lat": 1, "lng": 1, "description": 1}):
        if in_ny(r["lat"], r["lng"]):
            if (r.get("description") or "").strip() in SEED_REPORTS_BY_DESCRIPTION:
                c["NY synthetic seed"] += 1
            else:
                c["NY user submission"] += 1
                ny_user += 1
        elif 28.0 <= r["lat"] <= 29.2 and 77.0 <= r["lng"] <= 78.0:
            c["Delhi / Ghaziabad region"] += 1
        else:
            c["other region"] += 1
    for k, v in c.items():
        print(f"  {k:26s} {v}")
    print(f"\n  total reports: {db.reports.count_documents({})}")
    print(f"  NY user submissions (never modified by this script): {ny_user}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--rollback", action="store_true")
    ap.add_argument("--verify", action="store_true")
    args = ap.parse_args()

    client, db = connect()
    try:
        if args.verify:
            show(db)
            return 0
        if args.rollback:
            rollback(db)
            show(db)
            return 0

        changes, skipped = plan_changes(db)
        print("=== synthetic demo reports that WOULD change ===")
        if not changes:
            print("  (nothing to do)")
            show(db)
            return 0
        for c in changes:
            print(f"  [{c['area']:14s}] {c['old'][0]:8.4f},{c['old'][1]:9.4f}  ->  "
                  f"{c['new'][0]:8.4f},{c['new'][1]:9.4f}   {c['description']}")

        print(f"\n=== deliberately NOT touched ({len(skipped)}) ===")
        for doc, why in skipped:
            print(f"  {doc['_id']}  {doc.get('lat')},{doc.get('lng')}  — {why}")

        if args.dry_run or not args.apply:
            print("\nDRY RUN: no changes written." if args.dry_run else "\nUse --apply to write.")
            return 0

        print("\n=== backup ===")
        backup(db)

        print("\n=== applying ===")
        from bson import ObjectId

        for c in changes:
            db.reports.update_one(
                {"_id": ObjectId(c["_id"])},
                {"$set": {"lat": c["new"][0], "lng": c["new"][1]}},
            )
        print(f"  updated {len(changes)} report(s) (lat/lng only)")
        show(db)
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
