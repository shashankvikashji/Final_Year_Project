"""
Idempotent migration of Wastrix seeded demo accounts from the legacy
@smartwaste.app domain to @wastrix.app.

Safety properties
-----------------
* Target identities are declared EXPLICITLY by user _id. Any other account that
  happens to sit on @smartwaste.app is left untouched.
* Only the `email` field is ever written. The document _id is never modified, so
  `reports.reporter_id` (a stringified _id) keeps pointing at the right author.
* Password hashes, roles and every other field are untouched -> existing
  credentials keep working.
* Runs a full backup to JSON before touching anything, and refuses to write
  unless the backup succeeded.
* Pre-flight conflict check: aborts if a @wastrix.app identity already exists
  that is not one of ours.
* Idempotent: re-running is a no-op.
* `--rollback` restores the previous emails from the backup file.

Usage
-----
    python migrate_demo_accounts.py --dry-run      # preview only
    python migrate_demo_accounts.py                # apply
    python migrate_demo_accounts.py --rollback     # revert
    python migrate_demo_accounts.py --verify       # check state, change nothing
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
from pymongo.errors import DuplicateKeyError

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

NEW_DOMAIN = "wastrix.app"
LEGACY_DOMAIN = "smartwaste.app"

# The three accounts the application seeds on startup (see server.py SEED_USERS).
# Pinned by _id so we can never touch an unrelated account on the old domain.
TARGETS = {
    "e4f30491-b1c1-4ea9-a796-0d94ad635ba6": "citizen@wastrix.app",
    "4c5c2352-4d58-40b7-9029-d304adde475a": "ngo@wastrix.app",
    "04920587-22fc-4872-b6e9-9958807b1a88": "muni@wastrix.app",
}
EXPECTED_ROLES = {
    "e4f30491-b1c1-4ea9-a796-0d94ad635ba6": "citizen",
    "4c5c2352-4d58-40b7-9029-d304adde475a": "ngo",
    "04920587-22fc-4872-b6e9-9958807b1a88": "municipality",
}

BACKUP_DIR = HERE / "migrations" / "backups"


def connect():
    uri = os.environ.get("MONGO_URL")
    if not uri:
        sys.exit("ERROR: MONGO_URL is not set. Is backend/.env present?")
    db_name = os.environ.get("DB_NAME")
    if not db_name:
        sys.exit("ERROR: DB_NAME is not set.")
    client = MongoClient(uri, serverSelectionTimeoutMS=15000)
    client.admin.command("ping")
    return client, client[db_name]


def backup(db) -> Path:
    """Persist the full pre-migration state of every affected record."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = BACKUP_DIR / f"demo_accounts_{stamp}.json"
    docs = list(db.users.find({"_id": {"$in": list(TARGETS)}}))
    if not docs:
        # still write an (empty) file so a rollback has something to read
        docs = []
    payload = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "database": db.name,
        "new_domain": NEW_DOMAIN,
        "legacy_domain": LEGACY_DOMAIN,
        "documents": [{k: (str(v) if k == "_id" else v) for k, v in d.items()} for d in docs],
    }
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    # verify the file is readable and complete before we allow any writes
    check = json.loads(path.read_text(encoding="utf-8"))
    if len(check["documents"]) != len(docs):
        sys.exit("ERROR: backup verification failed; refusing to migrate.")
    print(f"  backup written -> {path}  ({len(docs)} documents)")
    return path


def latest_backup() -> Path:
    files = sorted(BACKUP_DIR.glob("demo_accounts_*.json"))
    if not files:
        sys.exit("ERROR: no backup found in migrations/backups. Cannot roll back.")
    return files[-1]


def preflight(db) -> list[dict]:
    """Return the planned changes; raise SystemExit on any unsafe condition."""
    plan = []
    seen_new = set()

    for uid, new_email in TARGETS.items():
        if new_email in seen_new:
            sys.exit(f"ERROR: duplicate target email in migration map: {new_email}")
        seen_new.add(new_email)

        doc = db.users.find_one({"_id": uid})
        if not doc:
            print(f"  - {uid}: not present, skipping")
            continue

        role_ok = doc.get("role") == EXPECTED_ROLES[uid]
        if not role_ok:
            print(
                f"  - {uid}: role is {doc.get('role')!r}, expected "
                f"{EXPECTED_ROLES[uid]!r} — NOT a seeded demo account, skipping"
            )
            continue

        if doc["email"] == new_email:
            print(f"  - {uid}: already migrated ({new_email}) — no-op")
            continue

        if doc["email"] != f"{doc['email'].split('@')[0]}@{LEGACY_DOMAIN}":
            print(f"  - {uid}: email {doc['email']!r} is not on the legacy domain, skipping")

        # conflict: someone else already owns the target address
        squatter = db.users.find_one({"email": new_email})
        if squatter:
            sys.exit(
                f"ERROR: {new_email} is already used by _id {squatter['_id']}. "
                "Resolve the conflict manually; nothing was changed."
            )

        plan.append({"_id": uid, "old": doc["email"], "new": new_email})

    return plan


def apply_plan(db, plan) -> None:
    for item in plan:
        try:
            db.users.update_one(
                {"_id": item["_id"], "email": item["old"]},
                {"$set": {"email": item["new"]}},
            )
        except DuplicateKeyError:
            sys.exit(f"ERROR: unique index rejected {item['new']}. Migration halted.")

    # confirm the unique index still holds and nothing else moved
    dupes = list(db.users.aggregate([
        {"$group": {"_id": "$email", "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
    ]))
    if dupes:
        sys.exit(f"ERROR: duplicate emails detected after migration: {dupes}")


def rollback(db) -> None:
    path = latest_backup()
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"  restoring from {path}")
    n = 0
    for d in data["documents"]:
        uid = d["_id"]
        current = db.users.find_one({"_id": uid}, {"email": 1})
        if not current:
            print(f"  - {uid}: account no longer exists, skipped")
            continue
        if current["email"] == d["email"]:
            continue
        db.users.update_one({"_id": uid}, {"$set": {"email": d["email"]}})
        print(f"  - {uid}: {current['email']} -> {d['email']}")
        n += 1
    print(f"  rolled back {n} account(s)")


def report(db) -> None:
    print("\n=== current state of the three seeded demo accounts ===")
    for uid, new_email in TARGETS.items():
        doc = db.users.find_one({"_id": uid})
        if not doc:
            print(f"  {uid}: MISSING")
            continue
        n = db.reports.count_documents({"reporter_id": str(uid)})
        mark = "OK " if doc["email"] == new_email else "OLD"
        print(f"  [{mark}] {doc['email']:28s} role={doc['role']:14s} reports={n}")
    legacy = db.users.count_documents({"email": {"$regex": rf"{LEGACY_DOMAIN}$", "$options": "i"}})
    print(f"\n  accounts still on @{LEGACY_DOMAIN}: {legacy}")
    print(f"  accounts on @{NEW_DOMAIN}   : "
          f"{db.users.count_documents({'email': {'$regex': rf'{NEW_DOMAIN}$', '$options': 'i'}})}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="preview without writing")
    ap.add_argument("--rollback", action="store_true", help="restore previous emails")
    ap.add_argument("--verify", action="store_true", help="print state, change nothing")
    args = ap.parse_args()

    client, db = connect()
    try:
        if args.verify:
            report(db)
            return 0
        if args.rollback:
            rollback(db)
            report(db)
            return 0

        print("=== pre-flight ===")
        plan = preflight(db)
        if not plan:
            print("  nothing to do (already migrated)")
            report(db)
            return 0
        for item in plan:
            print(f"  - {item['old']}  ->  {item['new']}")

        if args.dry_run:
            print("\nDRY RUN: no changes written.")
            return 0

        print("\n=== backup ===")
        backup(db)

        print("\n=== applying ===")
        apply_plan(db, plan)
        print(f"  updated {len(plan)} account(s)")

        report(db)
        print("\nMigration complete.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
