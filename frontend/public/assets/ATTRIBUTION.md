# Third-party asset attribution

All assets bundled in `frontend/public/assets/` are listed below with their source and licence.

---

## `hero-city.jpg`

**File on Wikimedia Commons:**
`File:KL Eco City (220709) 02.jpg`

| Field | Value |
|---|---|
| **Title** | KL Eco City (220709) 02 |
| **Author / photographer** | *angys* |
| **Licence** | **CC BY-SA 4.0** |
| **Source** | https://commons.wikimedia.org/wiki/File:KL_Eco_City_(220709)_02.jpg |
| **Used for** | Background photograph of the Wastrix sign-in / registration hero panel |

The image was cropped (centre-weighted) and resized to 1000×1250 px, then re-encoded as a
progressive JPEG at quality 82 for web delivery. The underlying work remains under
**CC BY-SA 4.0**; this file is a modified version and is distributed under the same licence.

Attribution is also rendered in the application footer of the authentication screen
(`frontend/src/pages/Auth.jsx`).

---

## `wastrix-logo.svg` and `favicon.svg`

Original work created for this project. No third-party source. Free to use with the project.

---

## Map tiles

The live map does **not** bundle imagery. Tiles are fetched at runtime from
**Esri World Light Gray Base** and **Esri World Light Gray Reference**:

- `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`
- `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`

© Esri, HERE, Garmin, © OpenStreetMap contributors. Attribution is displayed on the map
control as required by the provider's terms of use.

**Why this changed:** the previous basemap used CARTO `light_nolabels` / `light_only_labels`,
which now returns a *"API KEY REQUIRED — carto.com/basemaps/apikey"* placeholder tile instead
of map data. CARTO requires an account API key for those styles. Esri's Canvas Light Gray
services are keyless and return genuine cartography, which was verified by downloading and
visually inspecting the tiles.

---

## Fonts

Loaded at runtime from third-party CDNs (unchanged from the original project):

- **Cabinet Grotesk** — Fontshare (`api.fontshare.com`)
- **IBM Plex Sans**, **IBM Plex Mono** — Google Fonts (`fonts.googleapis.com`)

Both are licensed under the **SIL Open Font License 1.1**.
