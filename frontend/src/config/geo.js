/**
 * Single source of truth for Wastrix map geography.
 *
 * Previously coordinates were hard-coded in several places (WasteMap.jsx,
 * Dashboard.jsx, Landing.jsx), which is why the map kept opening on New York
 * even though the intended demo city is Ghaziabad, Uttar Pradesh.
 *
 * Change DEPLOYMENT here and the whole app follows.
 */

/** Intended demo deployment city. */
export const DEPLOYMENT = {
  key: "ghaziabad",
  name: "Ghaziabad",
  region: "Uttar Pradesh, India",
  /** [latitude, longitude] — Leaflet and GeoJSON both use lat first. */
  center: [28.6692, 77.4538],
  zoom: 13,
};

/** Small set of realistic neighbourhood points used by demo seed data. */
export const DEMO_NEIGHBOURHOODS = [
  { name: "Sadar Bazaar", lat: 28.6692, lng: 77.4538 },
  { name: "Khekra", lat: 28.7021, lng: 77.4361 },
  { name: "Mohan Nagar", lat: 28.6812, lng: 77.4702 },
  { name: "Loni border", lat: 28.6885, lng: 77.4136 },
  { name: "Vaishali", lat: 28.6602, lng: 77.4459 },
  { name: "Indrapuram", lat: 28.6295, lng: 77.3762 },
];

export const DEFAULT_CENTER = DEPLOYMENT.center;
export const DEFAULT_ZOOM = DEPLOYMENT.zoom;

/**
 * A coordinate pair is usable only if both numbers are finite and inside the
 * valid globe range. Guards against null, undefined, NaN, "" and 0,0 which the
 * API can legitimately return from a malformed client submission.
 */
export function isValidCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // reject the null island default
    !(lat === 0 && lng === 0)
  );
}

/** Filter a list of reports down to those with genuinely usable coordinates. */
export function reportsWithCoords(reports = []) {
  return reports.filter((r) => isValidCoord(Number(r.lat), Number(r.lng)));
}

/**
 * Bounds that fit every valid report, or null when there are none.
 * Leaflet expects [[south, west], [north, east]].
 */
export function boundsForReports(reports = []) {
  const valid = reportsWithCoords(reports);
  if (!valid.length) return null;
  let s = 90;
  let w = 180;
  let n = -90;
  let e = -180;
  for (const r of valid) {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (lat < s) s = lat;
    if (lat > n) n = lat;
    if (lng < w) w = lng;
    if (lng > e) e = lng;
  }
  // a single point gives zero-area bounds; nudge so Leaflet can frame it
  if (n - s < 0.001) {
    s -= 0.005;
    n += 0.005;
  }
  if (e - w < 0.001) {
    w -= 0.005;
    e += 0.005;
  }
  return [
    [s, w],
    [n, e],
  ];
}

/** True when reports sit far enough apart to be worth a wide view. */
export function reportsAreSpreadOut(reports = []) {
  const b = boundsForReports(reports);
  if (!b) return false;
  const [[s, w], [n, e]] = b;
  return n - s > 0.5 || e - w > 0.5;
}
