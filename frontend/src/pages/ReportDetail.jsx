import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, MapPin, CheckCircle2, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { api, apiError, timeAgo, PRIORITY_META } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { WasteMap } from "@/components/WasteMap";
import { PriorityBadge, StatusBadge, DetailStat } from "@/components/Badges";

const STEPS = [
  { key: "reported", label: "Reported", icon: Clock },
  { key: "in-progress", label: "In progress", icon: Loader2 },
  { key: "resolved", label: "Resolved", icon: CheckCircle2 },
];

const easeOut = [0.22, 0.8, 0.3, 1];

const SKELETON = () => (
  <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div className="wx-skeleton h-4 w-32 rounded" />
    <div className="wx-skeleton mt-5 h-9 w-3/4 rounded" />
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <div className="wx-skeleton h-80 rounded-xl" />
      <div className="space-y-6">
        <div className="wx-skeleton h-64 rounded-xl" />
        <div className="wx-skeleton h-48 rounded-xl" />
      </div>
    </div>
  </div>
);

export default function ReportDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isCrew = user?.role === "ngo" || user?.role === "municipality";

  useEffect(() => {
    setReport(null);
    setError("");
    api
      .get(`/reports/${id}`)
      .then(({ data }) => setReport(data))
      .catch((e) => setError(apiError(e, "Couldn't load that report.")));
  }, [id]);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const { data } = await api.patch(`/reports/${id}/status`, { status });
      setReport((r) => ({ ...r, status: data.status }));
      toast.success(`Status set to ${data.status}.`);
    } catch (e) {
      toast.error(apiError(e, "That status change didn't stick."));
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="wx-card rounded-xl border-rose-200 bg-rose-50 p-5">
            <p className="text-sm text-rose-700" data-testid="detail-error">
              {error}
            </p>
            <Link to="/dashboard" className="wx-btn wx-btn-ghost mt-4">
              <ArrowLeft size={14} /> Back to the map
            </Link>
          </div>
        </div>
      </div>
    );

  if (!report)
    return (
      <div className="min-h-screen bg-canvas">
        <AppHeader />
        <SKELETON />
      </div>
    );

  const created = new Date(report.created_at);
  const stepIndex = STEPS.findIndex((s) => s.key === report.status);
  const prioMeta = PRIORITY_META[report.priority] || PRIORITY_META.medium;

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6" data-testid="report-detail">
        <Link
          to="/dashboard"
          data-testid="detail-back-link"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to the map
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="mt-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={report.priority} testId="detail-priority" />
            <StatusBadge status={report.status} testId="detail-status" />
            <span className="tabnum font-mono text-[11px] text-ink-muted">
              {timeAgo(report.created_at)}
            </span>
          </div>
          <h1 className="mt-3 font-display text-[1.7rem] font-extrabold leading-tight text-ink-deep sm:text-[2rem]">
            {report.description}
          </h1>
        </motion.header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          {/* ---------- left: photo + AI rationale ---------- */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: easeOut }}
            className="wx-card overflow-hidden rounded-xl"
          >
            <div className="relative bg-slate-100">
              <motion.img
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: easeOut }}
                src={report.photo_url}
                alt={report.description}
                data-testid="detail-photo"
                className="h-[300px] w-full object-cover sm:h-[380px]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement?.classList.add("wx-photo-failed");
                }}
              />
              <span
                className="pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm"
                style={{ backgroundColor: prioMeta.color }}
              >
                {prioMeta.label} priority
              </span>
            </div>

            <div className="border-t border-hairline p-4 sm:p-5">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Sparkles size={14} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                    Why the model scored it {report.priority}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink" data-testid="detail-rationale">
                    {report.ai_rationale || "No rationale recorded for this report."}
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {report.detections && report.detections.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-hairline pt-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                        Waste detected by AI
                      </h3>
                      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                        {report.detections.map((d, i) => (
                          <motion.li
                            key={`${d.class}-${i}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.28, delay: 0.05 + i * 0.05, ease: easeOut }}
                            className="flex items-center justify-between rounded-lg border border-hairline bg-slate-50/70 px-3 py-2"
                          >
                            <span className="text-sm font-semibold capitalize text-ink">
                              {d.class}
                            </span>
                            <span className="tabnum font-mono text-sm font-semibold text-emerald-700">
                              {(d.confidence * 100).toFixed(1)}%
                            </span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* ---------- right: map, facts, resolution ---------- */}
          <div className="space-y-5">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: easeOut }}
              className="wx-card overflow-hidden rounded-xl"
            >
              <div className="relative">
                <WasteMap
                  testId="detail-map"
                  className="h-56 w-full"
                  reports={[report]}
                  selectedId={report.id}
                  center={[report.lat, report.lng]}
                  zoom={16}
                />
                <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink shadow-sm backdrop-blur">
                  <MapPin size={11} className="text-rose-500" /> Report site
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline">
                <DetailStat label="Latitude" value={report.lat.toFixed(5)} mono testId="detail-lat" />
                <DetailStat label="Longitude" value={report.lng.toFixed(5)} mono testId="detail-lng" />
                <DetailStat label="Filed" value={created.toLocaleString()} mono />
                <DetailStat
                  label="Reporter"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <User size={12} className="text-ink-muted" />
                      {report.reporter_name}
                    </span>
                  }
                />
              </dl>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18, ease: easeOut }}
              className="wx-card rounded-xl p-4 sm:p-5"
            >
              <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Resolution
              </h2>

              <ol className="mt-3.5 space-y-0">
                {STEPS.map((s, i) => {
                  const done = i <= stepIndex;
                  const current = i === stepIndex;
                  return (
                    <li key={s.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ${
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 bg-white text-slate-400"
                          } ${current ? "ring-4 ring-emerald-500/15" : ""}`}
                        >
                          <s.icon size={12} strokeWidth={2.6} />
                        </span>
                        {i < STEPS.length - 1 && (
                          <span
                            className={`my-0.5 w-0.5 flex-1 rounded transition-colors duration-300 ${
                              i < stepIndex ? "bg-emerald-400" : "bg-slate-200"
                            }`}
                            style={{ minHeight: 20 }}
                          />
                        )}
                      </div>
                      <span
                        className={`pb-4 pt-1 text-sm transition-colors duration-300 ${
                          current ? "font-bold text-ink" : done ? "font-medium text-ink-muted" : "text-slate-400"
                        }`}
                      >
                        {s.label}
                        {current && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                            Current
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {isCrew ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {STEPS.filter((s) => s.key !== report.status).map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      disabled={busy}
                      data-testid={`set-status-${s.key}`}
                      onClick={() => setStatus(s.key)}
                      className="wx-btn wx-btn-ghost px-3 py-2 text-xs"
                    >
                      {busy && <Loader2 size={12} className="animate-spin" />}
                      Set {s.label.toLowerCase()}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
                  Only NGO and municipality crews can change this status. You'll see it move here.
                </p>
              )}
            </motion.section>
          </div>
        </div>
      </main>
    </div>
  );
}
