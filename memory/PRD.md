# SmartWaste AI — PRD

## Original problem statement
Civic waste-reporting platform. Citizens report waste with a photo and location; an AI vision model
scores severity so cleanup crews know what to hit first; NGOs and municipal staff track resolution on
a live map. Three roles: Citizen, NGO, Municipality. Strict YAGNI scope — six screens, two data models.

## User choices (locked)
- AI priority: real vision model — `gemini-3.1-pro-preview` via Emergent LLM key
- Photo storage: base64 in MongoDB
- Auth: JWT email/password with role selection (Bearer token in `localStorage.sw_token`)
- Map: user picked Google Maps but never supplied an API key → shipped on **Leaflet + CARTO Positron**
  (muted basemap per design guidelines). Swap is isolated to `components/WasteMap.jsx`.

## Architecture
- Backend `/app/backend/server.py` — FastAPI, Motor/MongoDB, uuid string `_id`, bcrypt + PyJWT.
- Frontend CRA + Tailwind, raw Leaflet map component, sonner toasts.
- Design: `/app/design_guidelines.json`. Palette derived from the priority scale
  (low #3B82F6, medium #F59E0B, high #EA580C, critical #E11D48) on slate canvas #F8FAFC / ink #0F172A.
  Type pairing: Cabinet Grotesk (display) + IBM Plex Sans/Mono (body, tabular numerals).

## Data model
- `User`: id, name, email, role(citizen|ngo|municipality), password_hash, created_at
- `Report`: id, photo_url(base64 data URL), lat, lng, description, status(reported|in-progress|resolved),
  priority(low|medium|high|critical), ai_rationale, reporter_id, reporter_name, created_at

## Implemented (2026-06)
- Landing page: full-bleed live map hero with public seeded reports, priority legend with live counts,
  latest-report feed, four-step pipeline, priority-scale explainer, role explainer.
- Auth: sign in / register with role selection cards, demo-account quick fill, specific inline errors.
- Report flow: camera/file upload downscaled to 1280px JPEG base64, geolocation with specific permission
  errors, tap-to-place map pin, description; priority is AI-only, never user-settable.
- Dashboard: split queue + map. Citizen sees own reports newest-first, no status controls.
  NGO/Municipality see the ward-wide queue sorted critical→low with open/all filter, per-priority counts
  and inline status advance.
- Report detail: photo, priority + status badges, AI rationale, lat/lng, filed timestamp, reporter,
  resolution timeline, crew-only status controls.
- Backend: role-scoped list/detail (citizen 403 on others' reports), crew-only PATCH status, seeded
  demo users and six sample ward reports.
- Tested: 19/19 backend pytest, all critical frontend flows via Playwright, mobile 390x844 verified.

## Backlog
- P0: swap Leaflet for Google Maps once an API key is provided.
- P1: pagination on `/api/reports` and `/api/public/reports` (currently capped at 500/200).
- P1: move base64 photos to object storage if report volume grows.
- P2: geocoded street address on report detail instead of raw lat/lng.
- Out of scope by user instruction: notifications, chat, gamification, analytics, i18n, payments,
  admin panel, social sharing, comments.
