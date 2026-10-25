import { PRIORITY_META, STATUS_META } from "@/lib/api";

export const PriorityBadge = ({ priority, testId }) => {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span
      data-testid={testId}
      title={meta.note}
      className="wx-pill text-white shadow-sm"
      style={{ backgroundColor: meta.color }}
    >
      <span className="font-mono leading-none opacity-90">{meta.glyph}</span>
      {meta.label}
    </span>
  );
};

export const StatusBadge = ({ status, testId }) => {
  const meta = STATUS_META[status] || STATUS_META.reported;
  return (
    <span
      data-testid={testId}
      className="wx-pill border transition-colors duration-200"
      style={{ color: meta.color, borderColor: `${meta.color}59`, backgroundColor: `${meta.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
};

/** Small labelled statistic used in the detail page info panel. */
export const DetailStat = ({ label, value, mono = false, testId }) => (
  <div className="bg-white px-4 py-3">
    <dt className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">{label}</dt>
    <dd className={`mt-0.5 text-sm text-ink ${mono ? "tabnum font-mono" : "font-medium"}`} data-testid={testId}>
      {value}
    </dd>
  </div>
);
