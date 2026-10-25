import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Camera, Route, ScanEye, CheckCircle2, MapPin, Users, Loader2 } from "lucide-react";
import { API, PRIORITY_META, timeAgo } from "@/lib/api";
import { DEPLOYMENT, reportsWithCoords } from "@/config/geo";
import { WasteMap } from "@/components/WasteMap";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { WastrixLogo } from "@/components/WastrixLogo";

const ORDER = ["critical", "high", "medium", "low"];

const PIPELINE = [
  {
    icon: Camera,
    title: "Citizen submits a report",
    body: "A photo, the map pin and a short description are captured in seconds.",
  },
  {
    icon: ScanEye,
    title: "AI triages the waste",
    body: "The vision model reads the photo and scores severity, confidence and quantity.",
  },
  {
    icon: Route,
    title: "Priority engine ranks it",
    body: "Those scores combine into one dispatch priority so the worst site sorts first.",
  },
  {
    icon: CheckCircle2,
    title: "Crew resolves the site",
    body: "NGO and municipal teams move a site from reported to in-progress to resolved.",
  },
];

const ROLES = [
  {
    role: "Citizen",
    copy: "Files reports with a photo and pin, and tracks only their own submissions.",
  },
  {
    role: "NGO",
    copy: "Works the full ward queue sorted by priority and moves sites into progress.",
  },
  {
    role: "Municipality",
    copy: "Same queue, with the authority to close a site as resolved.",
  },
];

/** Count-up that respects prefers-reduced-motion. */
const useCountUp = (value) => {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (reduce || value === display) {
      setDisplay(value);
      return undefined;
    }
    let raf;
    const start = performance.now();
    const from = display;
    const step = (t) => {
      const p = Math.min((t - start) / 500, 1);
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return display;
};

const Stat = ({ label, value, suffix }) => {
  const n = useCountUp(value);
  return (
    <div>
      <dd className="tabnum font-display text-3xl font-extrabold leading-none text-white">
        {n}
        {suffix ? <span className="text-lg text-amber-400">{suffix}</span> : null}
      </dd>
      <dt className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </dt>
    </div>
  );
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 0.8, 0.3, 1] },
  }),
};

export default function Landing() {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/public/reports`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReports(Array.isArray(data) ? data : []);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const located = useMemo(() => reportsWithCoords(reports), [reports]);
  const counts = useMemo(
    () => ORDER.map((p) => ({ p, n: reports.filter((r) => r.priority === p).length })),
    [reports]
  );
  const open = reports.filter((r) => r.status !== "resolved").length;
  const latest = located.slice(0, 6);

  return (
    <div className="min-h-screen bg-canvas">
      {/* ============================ NAV ============================ */}
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-ink-deep text-white shadow-[0_1px_0_rgba(255,255,255,0.03)]">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center px-4 sm:px-6">
          <Link to="/" aria-label="Wastrix home" className="rounded-lg">
            <WastrixLogo variant="light" size={26} />
          </Link>
          <span className="ml-3 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:inline">
            {DEPLOYMENT.name} · Demo ward
          </span>
          <nav className="ml-auto flex items-center gap-2" aria-label="Primary">
            <Link
              to="/auth"
              data-testid="landing-signin-link"
              className="wx-btn px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/auth?mode=register"
              data-testid="landing-report-cta"
              className="wx-btn bg-amber-400 px-3.5 py-2 text-sm font-semibold text-ink-deep hover:bg-amber-300"
            >
              Report waste
            </Link>
          </nav>
        </div>
      </header>

      {/* ============================ HERO ============================ */}
      <section className="relative border-b border-hairline">
        <div className="grid lg:grid-cols-[minmax(380px,42%)_1fr]">
          {/* left: copy */}
          <div
            className="relative overflow-hidden bg-ink-deep px-6 py-12 text-white sm:px-10 lg:py-16"
            style={{
              backgroundImage:
                "linear-gradient(160deg, rgba(11,18,32,0.97) 0%, rgba(6,50,45,0.93) 100%)",
            }}
          >
            <div className="hairline-grid absolute inset-0 opacity-30" aria-hidden />
            <div
              className="wx-glow -top-20 -right-16 h-64 w-64 bg-emerald-500/20"
              aria-hidden="true"
            />
            <div className="relative">
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300"
              >
                <MapPin size={12} /> {DEPLOYMENT.name}, {DEPLOYMENT.region}
              </motion.p>

              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={1}
                className="mt-5 font-display text-[2.1rem] font-extrabold leading-[1.05] sm:text-[2.6rem] lg:text-[2.9rem]"
              >
                AI-driven civic
                <br />
                waste triage and
                <br />
                <span className="text-amber-400">priority dispatch</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={2}
                className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-slate-300"
              >
                Citizens report waste with a photo and a pin. Wastrix runs the photo through a
                YOLO vision model, converts the detections into a single priority score, and
                sorts the ward queue so crews reach the most urgent sites first.
              </motion.p>

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={3}
                className="mt-7 flex flex-wrap gap-3"
              >
                <Link
                  to="/auth?mode=register"
                  data-testid="hero-report-button"
                  className="wx-btn bg-white px-5 py-3 text-sm font-semibold text-ink-deep hover:bg-slate-100"
                >
                  Report waste <ArrowRight size={16} />
                </Link>
                <Link
                  to="/auth"
                  data-testid="hero-crew-button"
                  className="wx-btn border border-slate-600 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Open the crew queue
                </Link>
              </motion.div>

              <motion.dl
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={4}
                className="mt-10 grid max-w-sm grid-cols-3 gap-x-4 gap-y-5 border-t border-slate-800 pt-6"
              >
                <Stat label="Open sites" value={status === "ready" ? open : 0} />
                <Stat label="On this map" value={status === "ready" ? reports.length : 0} />
                <Stat label="Triage set by" value={0} suffix="AI" />
              </motion.dl>
            </div>
          </div>

          {/* right: live map */}
          <div className="relative h-[420px] lg:h-auto lg:min-h-[600px]">
            <WasteMap
              testId="landing-map"
              reports={located}
              selectedId={selected}
              onSelect={setSelected}
              className="absolute inset-0"
            />

            {status === "loading" && (
              <div className="absolute inset-0 z-[450] grid place-items-center bg-white/70 backdrop-blur-[1px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-ink-muted shadow-sm">
                  <Loader2 size={14} className="animate-spin" /> Loading ward reports…
                </span>
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 z-[450] grid place-items-center bg-white/85 p-6">
                <div className="max-w-xs rounded-xl border border-hairline bg-white p-4 text-center shadow-lg">
                  <p className="text-sm font-semibold text-ink">Reports unavailable</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    Could not reach the Wastrix API, so the live map and counts are empty.
                  </p>
                </div>
              </div>
            )}

            {status === "ready" && located.length === 0 && (
              <div className="absolute inset-0 z-[450] grid place-items-center bg-white/70 p-6">
                <div className="max-w-xs rounded-xl border border-hairline bg-white p-4 text-center shadow-lg">
                  <p className="text-sm font-semibold text-ink">No reports to plot yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    The map is centred on {DEPLOYMENT.name}. File the first report and it will
                    appear here.
                  </p>
                </div>
              </div>
            )}

            {/* floating legend */}
            <div className="wx-card absolute bottom-4 left-4 z-[400] w-[196px] rounded-xl p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                Priority on this map
              </p>
              <ul className="mt-2 space-y-1.5">
                {counts.map(({ p, n }) => (
                  <li key={p} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: PRIORITY_META[p].color }}
                    />
                    <span className="text-ink">{PRIORITY_META[p].label}</span>
                    <span className="tabnum ml-auto font-mono text-ink-muted">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ LATEST REPORTS ============================ */}
      <section className="border-b border-hairline bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-ink-deep">
                Latest reports on the map
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Real records from the {DEPLOYMENT.name} demo ward. Synthetic demonstration rows
                are seeded on first run.
              </p>
            </div>
            <Link
              to="/auth"
              className="wx-btn wx-btn-ghost text-sm"
              onMouseEnter={() => setSelected(null)}
            >
              Open the queue <ArrowRight size={15} />
            </Link>
          </div>

          {status === "loading" && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <li key={i} className="wx-card rounded-xl p-4">
                  <div className="wx-skeleton h-4 w-28 rounded" />
                  <div className="wx-skeleton mt-3 h-3.5 w-full rounded" />
                  <div className="wx-skeleton mt-2 h-3.5 w-2/3 rounded" />
                </li>
              ))}
            </ul>
          )}

          {status === "error" && (
            <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              The report feed could not be loaded. The map above is showing the default
              deployment area.
            </p>
          )}

          {status === "ready" && latest.length === 0 && (
            <p className="mt-6 text-sm text-ink-muted" data-testid="landing-empty-feed">
              No reports yet in this ward — be the first to file one.
            </p>
          )}

          {status === "ready" && latest.length > 0 && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {latest.map((r, i) => (
                <motion.li
                  key={r.id}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-60px" }}
                  custom={i % 3}
                  onMouseEnter={() => setSelected(r.id)}
                  data-testid={`landing-feed-item-${r.id}`}
                  className="wx-card wx-card-hover group rounded-xl"
                >
                  <Link to="/auth" className="block p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={r.priority} />
                      <StatusBadge status={r.status} />
                      <span className="tabnum ml-auto font-mono text-[11px] text-ink-muted">
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-snug text-ink">
                      {r.description}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 border-t border-hairline pt-3 text-[11px] text-ink-muted">
                      <MapPin size={11} className="text-slate-400" />
                      <span className="tabnum font-mono">
                        {Number(r.lat).toFixed(4)}, {Number(r.lng).toFixed(4)}
                      </span>
                      <ArrowRight
                        size={13}
                        className="ml-auto text-slate-300 transition-colors duration-200 group-hover:text-emerald-600"
                      />
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ============================ PIPELINE ============================ */}
      <section className="wx-surface border-b border-hairline">
        <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-extrabold text-ink-deep">
            How Wastrix processes a waste report
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((step, i) => (
              <motion.li
                key={step.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-60px" }}
                custom={i}
                className="wx-card wx-card-hover relative rounded-xl p-5"
              >
                <span className="tabnum absolute right-4 top-3 font-display text-3xl font-extrabold text-slate-100">
                  {i + 1}
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <step.icon size={17} />
                </span>
                <h3 className="mt-3 font-display text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================ PRIORITY + ROLES ============================ */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-display text-2xl font-extrabold text-ink-deep">
                How Wastrix determines priority
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                Every report is scored on the same four-band scale using the model's severity,
                detection confidence and object count. Crews always see the worst site first.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {ORDER.map((p, i) => (
                  <motion.li
                    key={p}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                    custom={i}
                    className="wx-card wx-card-hover flex items-start gap-3 rounded-xl p-4"
                  >
                    <span
                      className="mt-0.5 h-11 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PRIORITY_META[p].color }}
                    />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-ink">
                        {PRIORITY_META[p].label}
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-ink-muted">
                        {PRIORITY_META[p].note}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-ink-deep p-6 text-white sm:p-7">
              <div className="hairline-grid absolute inset-0 opacity-25" aria-hidden />
              <div className="relative">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-emerald-300">
                  <Users size={17} />
                </span>
                <h3 className="mt-3 font-display text-xl font-bold">
                  One platform, three roles
                </h3>
                <ul className="mt-5 space-y-4">
                  {ROLES.map((r) => (
                    <li key={r.role} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="leading-relaxed text-slate-300">
                        <span className="font-semibold text-white">{r.role}</span> — {r.copy}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth?mode=register"
                  data-testid="footer-register-cta"
                  className="wx-btn mt-6 bg-amber-400 px-5 py-2.5 text-sm font-semibold text-ink-deep hover:bg-amber-300"
                >
                  Create an account <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ CLOSING CTA ============================ */}
      <section className="wx-surface border-t border-hairline">
        <div className="mx-auto max-w-[1600px] px-4 py-14 sm:px-6">
          <div className="wx-card rounded-2xl px-6 py-10 text-center sm:px-10">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="mx-auto flex flex-col items-center"
            >
              <WastrixLogo variant="dark" size={40} />
              <h2 className="mt-5 max-w-2xl font-display text-[1.7rem] font-extrabold leading-tight text-ink-deep sm:text-[2.1rem]">
                See something that shouldn't be there? Report it in under a minute.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
                One photo and a pin is all it takes. Wastrix does the triage, and the nearest
                crew sees it at the right priority.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/auth?mode=register"
                  className="wx-btn wx-btn-emerald px-5 py-3 text-sm"
                >
                  Report waste <ArrowRight size={16} />
                </Link>
                <Link to="/auth" className="wx-btn wx-btn-ghost px-5 py-3 text-sm">
                  Sign in
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] leading-relaxed text-slate-400">
            Wastrix — AI civic waste reporting and triage · Demo deployment: {DEPLOYMENT.name},{" "}
            {DEPLOYMENT.region}
            <br />
            Map tiles © Esri, HERE, Garmin, © OpenStreetMap contributors
          </p>
          <nav className="flex flex-wrap gap-4 text-sm text-ink-muted">
            <Link to="/auth" className="transition-colors hover:text-ink">
              Sign in
            </Link>
            <Link to="/auth?mode=register" className="transition-colors hover:text-ink">
              Create account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
