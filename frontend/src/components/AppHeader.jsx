import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Plus, Map as MapIcon, ChevronDown, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { WastrixLogo } from "@/components/WastrixLogo";

const ROLE_LABEL = { citizen: "Citizen", ngo: "NGO crew", municipality: "Municipality" };

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

export const AppHeader = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // close the profile menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const doSignOut = () => {
    setMenuOpen(false);
    signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-ink-deep text-white shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-4 sm:px-6">
        <Link
          to="/dashboard"
          data-testid="header-logo"
          className="flex shrink-0 items-center gap-2.5 rounded-lg"
          aria-label="Wastrix home"
        >
          <WastrixLogo variant="light" size={26} />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Primary">
          <NavLink to="/dashboard" testId="nav-dashboard" icon={<MapIcon size={15} />}>
            Live map
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/report"
            data-testid="nav-new-report"
            className="wx-btn bg-emerald-500 px-3 py-2 text-[13px] font-semibold text-ink-deep hover:bg-emerald-400"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">Report waste</span>
            <span className="sm:hidden">Report</span>
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              data-testid="profile-menu-button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-800/40 py-1.5 pl-1.5 pr-2 transition-colors hover:border-slate-600 hover:bg-slate-800/70"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 text-[11px] font-bold text-ink-deep">
                {initials(user?.name)}
              </span>
              <span className="hidden text-left leading-tight md:block">
                <span className="block max-w-[9rem] truncate text-[13px] font-semibold">
                  {user?.name}
                </span>
                <span className="block text-[9.5px] uppercase tracking-[0.14em] text-emerald-300/80">
                  {ROLE_LABEL[user?.role]}
                </span>
              </span>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${
                  menuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  data-testid="profile-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute right-0 top-[calc(100%+8px)] w-60 origin-top-right overflow-hidden rounded-xl border border-hairline bg-white text-ink shadow-xl"
                >
                  <div className="border-b border-hairline bg-slate-50 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      <UserRound size={11} /> Signed in
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">{user?.name}</p>
                    <p className="truncate font-mono text-[11px] text-ink-muted">{user?.email}</p>
                    <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700 ring-1 ring-emerald-200">
                      {ROLE_LABEL[user?.role]}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="sign-out-button"
                    onClick={doSignOut}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

const NavLink = ({ to, testId, icon, children }) => (
  <Link
    to={to}
    data-testid={testId}
    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors duration-200 hover:bg-slate-800/70 hover:text-white"
  >
    {icon}
    {children}
  </Link>
);

export default AppHeader;
