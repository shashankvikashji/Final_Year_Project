# Wastrix — Demo Account Migration

Moves the three seeded demo accounts from the legacy `@smartwaste.app` domain to
`@wastrix.app`.

## What it changes

Only the `email` field, on exactly three accounts:

| Account | Old email | New email | Role |
|---|---|---|---|
| Priya Raman | `citizen@smartwaste.app` | `citizen@wastrix.app` | citizen |
| Clean Streets Collective | `ngo@smartwaste.app` | `ngo@wastrix.app` | ngo |
| Ward 4 Sanitation Office | `muni@smartwaste.app` | `muni@wastrix.app` | municipality |

**Nothing else is touched.** The document `_id` is never modified, so every
`reports.reporter_id` (a stringified `_id`) keeps pointing at the correct author.
Password hashes, roles, names and `created_at` are all preserved, so existing
credentials keep working without a re-login prompt on other devices.

## Safety design

- **Pinned by `_id`, not by domain pattern.** Any other account that happens to sit
  on `@smartwaste.app` would be left alone — the script never does a blanket
  domain sweep.
- **Role check.** Each target is confirmed against its expected role before it is
  migrated; a mismatch causes a skip, not a wrong write.
- **Conflict check.** Aborts if a `@wastrix.app` address is already taken by another
  account. Nothing is written.
- **Backup first.** Writes every affected document to
  `backend/migrations/backups/demo_accounts_<UTC timestamp>.json` and re-reads the
  file to confirm it is complete *before* any database write.
- **Unique index respected.** The `email_1` unique index is validated again after the
  write; the run halts if it is ever violated.
- **Idempotent.** Re-running is a no-op. Already-migrated accounts are reported and
  skipped.

## Usage

```powershell
cd backend

# 1. Preview — writes nothing
.\venv\Scripts\python.exe migrate_demo_accounts.py --dry-run

# 2. Apply (backs up automatically, then migrates)
.\venv\Scripts\python.exe migrate_demo_accounts.py

# 3. Confirm
.\venv\Scripts\python.exe migrate_demo_accounts.py --verify
```

## Rollback

The latest backup is used automatically:

```powershell
.\venv\Scripts\python.exe migrate_demo_accounts.py --rollback
```

Backups accumulate; `--rollback` reads the newest file in `backups/`.

## After migrating, update these by hand

The database is only half the change — these files still carry the old addresses
and are **not** modified by the script, because editing them before the migration
runs would break login:

| File | Lines | What |
|---|---|---|
| `backend/server.py` | 455–457 | `SEED_USERS` — future seeding |
| `backend/tests/test_smartwaste_backend.py` | 17–19 | `CITIZEN` / `NGO` / `MUNI` credentials |
| `frontend/src/pages/Auth.jsx` | 17–19 | demo-account buttons |

> **Order matters:** migrate the database first, then update these three files, then
> re-run the backend suite. Updating them before the migration will fail the auth
> tests.

## Not changed (intentionally)

`DB_NAME=smartwaste` in `backend/.env`. This is the **MongoDB database name**, not a
brand string. Renaming it would orphan every existing collection and lose all
reports and accounts. It is invisible to end users and can be changed later with a
proper data migration if desired.

---

## Chemical detection — known limitation

`server.py` contains a `chemical` entry in `severity_map`, but **the deployed model
has only six classes** (`electronic`, `glass`, `metal`, `organic`, `paper`,
`plastic`).

Verified state:

```
model classes      : electronic, glass, metal, organic, paper, plastic
severity_map keys  : chemical, electronic, glass, metal, organic, paper, plastic
UNREACHABLE keys   : chemical   -> always falls back to default severity 50
UNMAPPED classes   : (none)
```

**Consequence:** no detection can ever be classified as `chemical`, so that branch
is dead code. The mapping is retained deliberately — it is correct and harmless, and
it becomes live the moment a seven-class model is deployed. It must not be
described as a working chemical detector.

Adding a real chemical class requires properly annotated chemical-waste images
(≥200 unique, bounding-box labelled). The only candidate data found so far depicts
polluted water bodies rather than discarded containers, so it is unsuitable.
That work is a separate ML task; it was deliberately not attempted here.
