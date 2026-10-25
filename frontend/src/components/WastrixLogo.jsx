/**
 * Wastrix brand mark + wordmark.
 * Single source of truth for the product identity across every screen.
 */
export const WastrixMark = ({ size = 28, className = "" }) => (
  <span
    className={`grid place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shrink-0 ${className}`}
    style={{ width: size, height: size }}
    aria-hidden="true"
  >
    <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none">
      <path
        d="M12 3.2c-4.6 0-8.4 3.2-9.6 7.3a2 2 0 0 0 .8 2.4l1 .7a2 2 0 0 0 2.8-1.7A6.4 6.4 0 0 1 12 8.4a6.4 6.4 0 0 1 6.4 6.4c0 1.7-.7 3.3-1.9 4.4a2 2 0 0 0 2.8 2.9A10.4 10.4 0 0 0 22.4 14.8 10.4 10.4 0 0 0 12 3.2Z"
        fill="#ffffff"
        fillOpacity="0.95"
      />
      <path
        d="M12 13.2a5.6 5.6 0 0 0-5.6 5.6 1.9 1.9 0 0 0 2.8 1.7 1.9 1.9 0 0 0 1.7-1.8 1.1 1.1 0 0 1 1.1-1.1 1.1 1.1 0 0 1 1.1 1.1 1.9 1.9 0 0 0 2.8 1.7 5.6 5.6 0 0 0-3.9-7.3Z"
        fill="#A7F3D0"
      />
    </svg>
  </span>
);

/**
 * @param {object} props
 * @param {"light"|"dark"} props.variant  light = for dark backgrounds, dark = for light backgrounds
 */
export const WastrixLogo = ({ variant = "dark", size = 28, showText = true, className = "", testId }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} data-testid={testId}>
    <WastrixMark size={size} />
    {showText && (
      <span
        className={`font-display font-extrabold tracking-tight leading-none ${
          variant === "light" ? "text-white" : "text-ink-deep"
        }`}
        style={{ fontSize: size * 0.54 }}
      >
        Wastrix
      </span>
    )}
  </span>
);

export default WastrixLogo;
