/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cabinet Grotesk"', '"IBM Plex Sans"', "sans-serif"],
        sans: ['"IBM Plex Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        ink: { DEFAULT: "#0F172A", muted: "#475569", deep: "#0B1220" },
        canvas: "#F8FAFC",
        hairline: "#E2E8F0",
        prio: {
          low: "#3B82F6",
          medium: "#F59E0B",
          high: "#EA580C",
          critical: "#E11D48",
        },
        state: {
          reported: "#475569",
          progress: "#3B82F6",
          resolved: "#10B981",
        },
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "pin-drop": {
          "0%": { transform: "translateY(-28px) scale(0.6)", opacity: "0" },
          "70%": { transform: "translateY(2px) scale(1.04)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "sweep": { "0%": { opacity: "0.55", transform: "scale(0.4)" }, "100%": { opacity: "0", transform: "scale(2.4)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pin-drop": "pin-drop 380ms cubic-bezier(.2,.8,.3,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
