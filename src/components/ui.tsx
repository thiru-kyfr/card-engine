import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  accent,
}: {
  children: ReactNode;
  className?: string;
  accent?: "teal" | "rose" | "gold";
}) {
  const border =
    accent === "teal"
      ? "var(--teal)"
      : accent === "rose"
        ? "var(--rose)"
        : accent === "gold"
          ? "var(--gold)"
          : "var(--line)";
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{ background: "var(--paper-raised)", borderColor: border }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-3 font-mono-num text-[10.5px] uppercase tracking-[0.09em]"
      style={{ color: "var(--ink-faint)" }}
    >
      {children}
    </p>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "rose" | "gold";
}) {
  const map = {
    neutral: { bg: "var(--paper-sunken)", fg: "var(--ink-muted)" },
    teal: { bg: "var(--teal-soft)", fg: "var(--teal)" },
    rose: { bg: "var(--rose-soft)", fg: "var(--rose)" },
    gold: { bg: "var(--gold-soft)", fg: "var(--gold)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono-num text-[10px] font-semibold uppercase tracking-[0.05em]"
      style={{ background: map.bg, color: map.fg }}
    >
      {children}
    </span>
  );
}

export function Callout({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: "teal" | "rose" | "gold";
}) {
  const bg =
    tone === "rose" ? "var(--rose-soft)" : tone === "gold" ? "var(--gold-soft)" : "var(--teal-soft)";
  return (
    <div className="rounded-lg px-4 py-3 text-[13px]" style={{ background: bg }}>
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "var(--teal)" : tone === "neg" ? "var(--rose)" : "var(--ink-muted)";
  const border =
    tone === "pos" ? "var(--teal)" : tone === "neg" ? "var(--rose)" : "var(--line)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono-num text-[11.5px]"
      style={{ color, borderColor: border, background: "var(--paper-raised)" }}
    >
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
