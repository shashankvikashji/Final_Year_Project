import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ChevronRight, ListFilter, Inbox, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, PRIORITY_META, timeAgo } from "@/lib/api";
import { DEPLOYMENT, reportsWithCoords } from "@/config/geo";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { WasteMap } from "@/components/WasteMap";
import { PriorityBadge, StatusBadge } from "@/components/Badges";

const NEXT_STATUS = {
  reported: { to: "in-progress", label: "Start work" },
  "in-progress": { to: "resolved", label: "Mark resolved" },
  resolved: null,
};

const ORDER = ["critical", "high", "medium", "low"];
const easeOut = [0.22, 0.8, 0.3, 1];

/** Counts up to `value` so live stats animate instead of snapping. */
const useCountUp = (value) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === display) {
      setDisplay(value);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const from = display;
    const step = (t) => {
      const p = Math.min((t - start) / 420, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
};

const StatCard = ({ priority, count, index }) => {
  const meta = PRIORITY_META[priority];
  const n = useCountUp(count);
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: easeOut }}
      className="wx-card wx-card-hover group relative overflow-hidden rounded-xl p-3"
      data-testid={`queue-count-${priority}`}
    >
      <span
        className="absolute inset-x-0 top-0 h-1 transition-all duration-300"
        style={{ backgroundColor: meta.color }}
      />
      <span
        className="mt-1 block font-display text-[1.6rem] font-extrabold leading-none tabnum"
        style={{ color: meta.color }}
      >
        {n}
      </span>
      <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
        {meta.label}
      </span>
    </motion.li>
  );
};

const ReportRow = ({ report: r, selected, isCrew, updating, onHover, onOpen, onAdvance, index }) => (
  <motion.li
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.4), ease: easeOut }}
    data-testid={`report-row-${r.id}`}
    onMouseEnter={() => onHover(r.id)}
    onClick={() => onHover(r.id)}
    className={`cursor-pointer border-b border-hairline px-4 py-3.5 transition-colors duration-200 last:border-0 ${
      selected ? "bg-emerald-50/45" : "hover:bg-slate-50"
    }`}
  >
    <div className="flex flex-wrap items-center gap-2">
      <PriorityBadge priority={r.priority} testId={`row-priority-${r.id}`} />
      <StatusBadge status={r.status} testId={`row-status-${r.id}`} />
      <span className="tabnum ml-auto font-mono text-[11px] text-ink-muted">{timeAgo(r.created_at)}</span>
    </div>

    <p className="mt-2 line-clamp-2 text-sm leading-snug text-ink">{r.description}</p>

    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
      <span className="tabnum font-mono text-slate-400">
        {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
      </span>
      {isCrew && <span>filed by {r.reporter_name}</span>}
    </div>

    <div className="mt-3 flex items-center gap-2">
      <button
        data-testid={`open-report-${r.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(r.id);
        }}
        className="wx-btn px-1.5 py-1 text-xs font-semibold text-ink-deep hover:text-emerald-700"
      >
        Open report <ChevronRight size={13} />
      </button>
      {isCrew && NEXT_STATUS[r.status] && (
        <button
          data-testid={`advance-status-${r.id}`}
          disabled={updating === r.id}
          onClick={(e) => {
            e.stopPropagation();
            onAdvance(r);
          }}
          className="wx-btn ml-auto border border-hairline bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-ink-deep hover:bg-ink-deep hover:text-white"
        >
          {updating === r.id && <Loader2 size={12} className="animate-spin" />}
          {NEXT_STATUS[r.status].label}
        </button>
      )}
    </div>
  </motion.li>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter] = useState("open");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isCrew = user?.role === "ngo" || user?.role === "municipality";

  useEffect(() => {
    api
      .get("/reports")
      .then(({ data }) => setReports(data))
      .catch((e) => setError(apiError(e, "Couldn't load the report queue.")))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let list = [...reports];
    if (isCrew && filter === "open") list = list.filter((r) => r.status !== "resolved");
    if (isCrew) {
      list.sort(
        (a, b) =>
          PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
          new Date(b.created_at) - new Date(a.created_at)
      );
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [reports, isCrew, filter]);

  const advance = async (report) => {
    const next = NEXT_STATUS[report.status];
    if (!next) return;
    setUpdating(report.id);
    try {
      const { data } = await api.patch(`/reports/${report.id}/status`, { status: next.to });
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: data.status } : r)));
      toast.success(`Site moved to ${data.status}.`);
    } catch (e) {
      toast.error(apiError(e, "That status change didn't stick."));
    } finally {
      setUpdating(null);
    }
  };

  const counts = useMemo(
    () =>
      ORDER.map((p) => ({
        p,
        n: reports.filter((r) => r.priority === p && r.status !== "resolved").length,
      })),
    [reports]
  );

  const openCount = reports.filter((r) => r.status !== "resolved").length;

  // Only plots reports with usable coordinates; malformed rows are dropped rather
  // than landing the map on null island.
  const visibleReports = useMemo(() => reportsWithCoords(visible), [visible]);

  const sidebar = (
    <aside className="flex h-full min-h-0 w-full flex-col border-hairline bg-white lg:w-[400px] lg:shrink-0 lg:border-r lg:overflow-hidden xl:w-[440px]">
      <div className="border-b border-hairline px-4 py-4 sm:px-5">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <h1
              className="font-display text-[1.45rem] font-extrabold leading-tight text-ink-deep"
              data-testid="dashboard-title"
            >
              {isCrew ? "Ward cleanup queue" : "My reports"}
            </h1>
            <p className="mt-1 text-[13px] leading-snug text-ink-muted">
              {isCrew
                ? "Every open site in the ward, worst first. You set the status."
                : "Everything you've filed, newest first."}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {DEPLOYMENT.name} demo ward
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="ml-auto rounded-lg border border-hairline p-2 text-ink-muted lg:hidden"
            aria-label="Close queue"
          >
            ✕
          </button>
        </div>

        {isCrew && (
          <>
            <ul className="mt-4 grid grid-cols-4 gap-2">
              {counts.map(({ p, n }, i) => (
                <StatCard key={p} priority={p} count={n} index={i} />
              ))}
            </ul>

            <div className="mt-3.5 flex items-center justify-between gap-2">
              <div
                className="inline-flex rounded-lg border border-hairline bg-slate-50 p-0.5"
                role="group"
                aria-label="Filter queue"
              >
                {[
                  ["open", "Open"],
                  ["all", "All"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`queue-filter-${k}`}
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                    className={`relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                      filter === k ? "text-white" : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {filter === k && (
                      <motion.span
                        layoutId="queue-filter-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-md bg-ink-deep"
                      />
                    )}
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
              <span className="tabnum flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-muted">
                <Inbox size={12} /> {openCount} open
              </span>
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="report-list">
        {loading && (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="wx-card rounded-xl p-3.5">
                <div className="wx-skeleton h-4 w-24 rounded" />
                <div className="wx-skeleton mt-2.5 h-3.5 w-full rounded" />
                <div className="wx-skeleton mt-1.5 h-3.5 w-2/3 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="p-6 text-center" data-testid="report-list-empty">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <AlertTriangle size={19} />
            </span>
            <p className="mt-3 text-sm text-ink-muted">
              {isCrew
                ? "Nothing open in this ward right now. New citizen reports land here the moment they're triaged."
                : "No reports yet in your area — be the first. Snap the site, drop the pin, we handle the rest."}
            </p>
            {!isCrew && (
              <Link to="/report" className="wx-btn wx-btn-emerald mt-4">
                Report waste
              </Link>
            )}
          </div>
        )}

        <ul>
          <AnimatePresence initial={false}>
            {visible.map((r, i) => (
              <ReportRow
                key={r.id}
                report={r}
                index={i}
                selected={selected === r.id}
                isCrew={isCrew}
                updating={updating}
                onHover={setSelected}
                onOpen={(id) => navigate(`/reports/${id}`)}
                onAdvance={advance}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </aside>
  );

  return (
    // On desktop this is a viewport-height split view: the shell is exactly one
    // screen tall and locked, so the queue scrolls inside its own pane and the map
    // keeps a stable height instead of stretching to the length of the list.
    // Mobile keeps normal page scrolling.
    <div className="flex min-h-screen flex-col bg-canvas lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <AppHeader />

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* mobile drawer toggle */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          data-testid="open-queue-drawer"
          className="wx-btn wx-btn-ghost mx-3 mt-3 self-start lg:hidden"
        >
          <ListFilter size={15} /> Queue ({visible.length})
        </button>

        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-40 bg-ink-deep/45 backdrop-blur-[2px] lg:hidden"
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
                className="fixed inset-y-0 left-0 z-50 w-[86%] max-w-sm lg:hidden"
              >
                {sidebar}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="hidden min-h-0 lg:flex">{sidebar}</div>

        <div className="relative min-h-[420px] flex-1 lg:min-h-0 lg:overflow-hidden">
          <WasteMap
            testId="dashboard-map"
            reports={visibleReports}
            selectedId={selected}
            onSelect={setSelected}
            className="absolute inset-0"
          />

          {/* priority legend */}
          <div className="wx-card absolute right-3 top-3 z-[400] rounded-xl px-3.5 py-2.5 sm:right-4 sm:top-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Priority
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {ORDER.map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-[11px] text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: PRIORITY_META[p].color }}
                  />
                  {PRIORITY_META[p].label}
                </li>
              ))}
            </ul>
          </div>

          {/* count chip */}
          <div className="wx-card absolute left-3 top-3 z-[400] rounded-xl px-3.5 py-2 sm:left-4 sm:top-4">
            <p className="tabnum font-display text-lg font-extrabold leading-none text-ink-deep">
              {visible.length}
            </p>
            <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
              {isCrew && filter === "open" ? "Open sites" : "Reports shown"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
