import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { PRIORITY_META } from "@/lib/api";
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  boundsForReports,
  reportsAreSpreadOut,
  reportsWithCoords,
} from "@/config/geo";

// Basemap: Esri "Canvas World Light Gray" — keyless, no API key, no watermark.
// (CARTO basemaps now return an "API KEY REQUIRED" placeholder tile.)
const TILE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ATTR =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MAX_ZOOM = 19;

const pinIcon = (priority, selected) => {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return L.divIcon({
    className: `sw-pin${selected ? " sw-pin-selected" : ""}`,
    html: `<div class="sw-pin-inner" style="background:${meta.color}">${meta.glyph}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

export const WasteMap = ({
  reports = [],
  selectedId = null,
  onSelect,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  pickMode = false,
  pickedPoint = null,
  onPick,
  className = "",
  testId = "waste-map",
  /** Frame the viewport around the supplied reports instead of the default centre. */
  fitToReports = true,
}) => {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const pickRef = useRef(null);
  const onPickRef = useRef(onPick);
  const [tilesFailed, setTilesFailed] = useState(false);
  onPickRef.current = onPick;

  // Only reports with genuinely usable coordinates become markers. The API can
  // return null / "" / 0,0 from a malformed submission and Leaflet would either
  // throw or drop the marker at null island. Memoised so the effect below does
  // not re-run on every parent render.
  const validReports = useMemo(() => reportsWithCoords(reports), [reports]);

  // Bounds are derived once from the initial report set so the first paint already
  // frames the data instead of flashing the default city then jumping.
  const initialBounds = fitToReports ? boundsForReports(validReports) : null;
  const spread = fitToReports ? reportsAreSpreadOut(validReports) : false;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (mapRef.current) return undefined;

    const map = L.map(node, {
      center,
      zoom,
      zoomControl: true,
      scrollWheelZoom: !pickMode,
    });
    if (initialBounds) {
      map.fitBounds(initialBounds, { padding: [48, 48], maxZoom: spread ? 12 : 16, animate: false });
    }
    const base = L.tileLayer(TILE, { attribution: ATTR, maxZoom: MAX_ZOOM });
    base.on("tileerror", () => setTilesFailed(true));
    base.on("tileload", () => setTilesFailed(false));
    base.addTo(map);
    L.tileLayer(LABELS, { maxZoom: MAX_ZOOM, opacity: 0.9 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (e) => onPickRef.current && onPickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;

    // ---- lifecycle guard -------------------------------------------------
    // `map.remove()` tears down the Leaflet panes. Any invalidateSize() that
    // runs afterwards dereferences a now-undefined map pane and throws
    // "Cannot read properties of undefined (reading '_leaflet_pos')".
    //
    // Every deferred resize therefore goes through safeInvalidate(), which
    // refuses to touch an instance that has been destroyed or replaced, and
    // only fires once the container actually has a size to report.
    let destroyed = false;
    let frame = null;
    let settleTimer = null;

    const safeInvalidate = () => {
      if (destroyed || mapRef.current !== map) return;
      if (!node.isConnected) return;
      if (node.clientWidth === 0 || node.clientHeight === 0) return;
      map.invalidateSize({ animate: false });
    };

    // Deferred resize for the initial layout pass. The id is captured so cleanup
    // can cancel it — previously this timer was never cleared, so unmounting
    // within 120ms left a live callback pointing at a removed map.
    settleTimer = setTimeout(() => {
      settleTimer = null;
      safeInvalidate();
    }, 120);

    // Keep the map correct when its box changes (sidebar toggle, window resize,
    // orientation change) without polling on every render.
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        if (destroyed) return;
        if (frame !== null) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          frame = null;
          safeInvalidate();
        });
      });
      observer.observe(node);
    }

    return () => {
      // Flip the flag first so nothing scheduled can reach the dying instance.
      destroyed = true;
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      if (settleTimer !== null) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      map.off();
      map.remove();
      layerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    // validReports === [lat, lng] in that order — matches Leaflet's API.
    validReports.forEach((r) => {
      L.marker([Number(r.lat), Number(r.lng)], {
        icon: pinIcon(r.priority, r.id === selectedId),
        keyboard: true,
        title: r.description,
      })
        .addTo(layer)
        .on("click", () => onSelect && onSelect(r.id));
    });
  }, [validReports, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pickRef.current) {
      map.removeLayer(pickRef.current);
      pickRef.current = null;
    }
    if (pickedPoint) {
      pickRef.current = L.marker(pickedPoint, { icon: pinIcon("medium", true) }).addTo(map);
      map.setView(pickedPoint, Math.max(map.getZoom(), 16));
    }
  }, [pickedPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const r = reports.find((x) => x.id === selectedId);
    // Guard against a stale reference surviving an unmount/remount cycle.
    if (r && mapRef.current === map) map.panTo([Number(r.lat), Number(r.lng)], { animate: true });
  }, [selectedId, reports]);

  // The wrapper carries the caller's layout class. Only add `relative` when the
  // caller did NOT already position it (Tailwind emits `.relative` after
  // `.absolute`, so combining them would override the caller's positioning).
  const positioned = /\b(absolute|fixed|sticky)\b/.test(className);

  return (
    <div className={`${positioned ? "" : "relative "}${className}`}>
      <div ref={nodeRef} data-testid={testId} className="h-full w-full" />
      {tilesFailed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-slate-50/92 p-6"
        >
          <div className="max-w-xs rounded-xl border border-hairline bg-white p-4 text-center shadow-lg">
            <p className="text-sm font-semibold text-ink">Map tiles unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              The basemap provider could not be reached. Report markers and coordinates are
              still accurate — check your network connection and reload.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
