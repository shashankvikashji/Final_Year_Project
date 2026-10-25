import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Eye, EyeOff, Sparkles, MapPinned, Users, ShieldCheck } from "lucide-react";
import { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { WastrixLogo } from "@/components/WastrixLogo";

const ROLES = [
  { key: "citizen", label: "Citizen", desc: "File reports and follow your own sites." },
  { key: "ngo", label: "NGO", desc: "Work the ward queue and mark sites in progress." },
  { key: "municipality", label: "Municipality", desc: "Work the queue and close sites as resolved." },
];

const DEMO_ACCOUNTS = [
  ["citizen@smartwaste.app", "Citizen"],
  ["ngo@smartwaste.app", "NGO"],
  ["muni@smartwaste.app", "Municipality"],
];

const HIGHLIGHTS = [
  { icon: Sparkles, title: "AI waste detection", copy: "A YOLO model reads every photo and names the waste material." },
  { icon: MapPinned, title: "Priority triage", copy: "Severity, confidence and quantity become one dispatch score." },
  { icon: Users, title: "Community reporting", copy: "Anyone can pin a site; crews work the ward queue worst-first." },
];

const easeOut = [0.22, 0.8, 0.3, 1];

export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "citizen" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        await signIn("/auth/register", form);
        toast.success("Account created. You're signed in.");
      } else {
        await signIn("/auth/login", { email: form.email, password: form.password });
        toast.success("Signed in.");
      }
      navigate("/dashboard");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (email) => {
    setMode("login");
    setForm({ ...form, email, password: "waste1234" });
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[48%_52%]">
      {/* ================= LEFT : environmental hero ================= */}
      <aside
        className="wx-hero relative isolate overflow-hidden text-white flex flex-col"
        style={{
          backgroundImage:
            "linear-gradient(160deg, rgba(11,18,32,0.93) 0%, rgba(6,78,59,0.80) 55%, rgba(4,47,46,0.95) 100%), url('/assets/hero-city.jpg')",
        }}
      >
        {/* smart-city grid + glows */}
        <div className="wx-hero-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="wx-glow -top-24 -left-16 h-72 w-72 bg-emerald-500/25" aria-hidden="true" />
        <div
          className="wx-glow bottom-[-6rem] right-[-4rem] h-80 w-80 bg-sky-500/20"
          style={{ animationDelay: "-6s" }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#041f2e]/85 to-transparent" aria-hidden="true" />

        <div className="relative z-10 flex h-full flex-col p-6 sm:p-9 lg:p-11">
          <Link to="/" data-testid="auth-home-link" className="inline-flex w-fit rounded-lg">
            <WastrixLogo variant="light" size={30} testId="auth-logo" />
          </Link>

          <div className="flex-1 flex flex-col justify-center py-10 lg:py-0">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200"
            >
              <ShieldCheck size={13} /> AI civic waste platform
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: easeOut }}
              className="mt-5 font-display font-extrabold text-[2.1rem] leading-[1.06] sm:text-[2.6rem] lg:text-[3rem] max-w-[13ch]"
            >
              Smarter waste management. Cleaner communities.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: easeOut }}
              className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-emerald-50/80"
            >
              Wastrix pairs computer vision with priority ageing. Photos are classified on
              arrival, scored for severity, and pushed to the top of a ward queue so crews
              reach the sites that actually need them first.
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 space-y-3.5"
            >
              {HIGHLIGHTS.map(({ icon: Icon, title, copy }, i) => (
                <motion.li
                  key={title}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.36 + i * 0.09, ease: easeOut }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10 backdrop-blur">
                    <Icon size={15} className="text-emerald-300" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{title}</span>
                    <span className="block text-[13px] leading-snug text-emerald-50/70">{copy}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          <div className="border-t border-white/12 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/60">
              Demo accounts
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map(([email, label]) => (
                <button
                  key={email}
                  type="button"
                  data-testid={`demo-fill-${label.toLowerCase()}`}
                  onClick={() => fillDemo(email)}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-emerald-50 transition-colors hover:border-emerald-400/60 hover:bg-emerald-400/15"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-snug text-emerald-100/45">
              Hero photograph: "KL Eco City", photo by <em>angys</em>, licensed{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-emerald-200"
              >
                CC BY-SA 4.0
              </a>
              .
            </p>
          </div>
        </div>
      </aside>

      {/* ================= RIGHT : authentication ================= */}
      <main className="wx-surface flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
          className="mx-auto w-full max-w-[420px]"
        >
          <Link
            to="/"
            className="mb-7 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink lg:hidden"
          >
            <ArrowLeft size={15} /> Back
          </Link>

          {/* tab switch */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="inline-flex rounded-xl border border-hairline bg-white p-1 shadow-sm"
          >
            {[
              ["login", "Sign in"],
              ["register", "Create account"],
            ].map(([m, label]) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                data-testid={`auth-tab-${m}`}
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                  mode === m ? "text-white" : "text-ink-muted hover:text-ink"
                }`}
              >
                {mode === m && (
                  <motion.span
                    layoutId="auth-tab-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-ink-deep"
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>

          <h2 className="mt-6 font-display text-[1.75rem] font-extrabold leading-tight text-ink-deep">
            {mode === "login" ? "Sign in to Wastrix" : "Create your Wastrix account"}
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {mode === "login"
              ? "Pick up your ward queue exactly where you left it."
              : "Choose a role — it decides what you can see and do."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4" data-testid="auth-form" noValidate={false}>
            <AnimatePresence initial={false} mode="popLayout">
              {mode === "register" && (
                <motion.div
                  key="register-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: easeOut }}
                  className="space-y-4 overflow-hidden"
                >
                  <div>
                    <label htmlFor="name" className="wx-label">
                      Full name or organisation
                    </label>
                    <input
                      id="name"
                      data-testid="auth-name-input"
                      required
                      autoComplete="organization"
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Priya Raman"
                      className="wx-field mt-1.5"
                    />
                  </div>

                  <fieldset>
                    <legend className="wx-label">What are you signing up as?</legend>
                    <div className="mt-1.5 grid gap-2">
                      {ROLES.map((r) => (
                        <button
                          type="button"
                          key={r.key}
                          data-testid={`role-option-${r.key}`}
                          onClick={() => setForm({ ...form, role: r.key })}
                          aria-pressed={form.role === r.key}
                          className={`rounded-lg border px-3.5 py-2.5 text-left transition-all duration-200 ${
                            form.role === r.key
                              ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500"
                              : "border-hairline bg-white hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <span className="block text-sm font-semibold text-ink">{r.label}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{r.desc}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label htmlFor="email" className="wx-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                data-testid="auth-email-input"
                required
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@city.gov"
                className="wx-field mt-1.5"
              />
            </div>

            <div>
              <label htmlFor="password" className="wx-label">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  data-testid="auth-password-input"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="At least 6 characters"
                  aria-describedby={error ? "auth-error" : undefined}
                  className="wx-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-muted transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  id="auth-error"
                  role="alert"
                  data-testid="auth-error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={busy}
              data-testid="auth-submit-button"
              className="wx-btn wx-btn-emerald w-full py-3"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-7 lg:hidden">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              Demo accounts
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map(([email, label]) => (
                <button
                  key={email}
                  type="button"
                  data-testid={`demo-fill-mobile-${label.toLowerCase()}`}
                  onClick={() => fillDemo(email)}
                  className="wx-btn wx-btn-ghost px-3 py-1.5 text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-ink-muted">
            By continuing you agree to report only waste sites you can genuinely verify.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
