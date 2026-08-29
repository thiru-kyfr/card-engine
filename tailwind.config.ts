import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)", raised: "var(--paper-raised)", sunken: "var(--paper-sunken)",
        ink: "var(--ink)", muted: "var(--ink-muted)", faint: "var(--ink-faint)",
        line: "var(--line)", teal: "var(--teal)", gold: "var(--gold)", rose: "var(--rose)",
      },
      fontFamily: { sans: ["var(--font-sans)"], mono: ["var(--font-mono)"], serif: ["var(--font-serif)"] },
    },
  },
  plugins: [],
} satisfies Config;
