import type { ButtonHTMLAttributes, ReactNode } from "react";

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
      className={`rounded-2xl border ${className}`}
      style={{
        background: "var(--paper-raised)",
        borderColor: border,
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-sm)",
      }}
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

/**
 * A real subheading — for the title of a card/section within a step, as
 * distinct from SectionLabel (a small tertiary caption or table header).
 */
export function SectionTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-[18px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
        {children}
      </h2>
      {description && (
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A field label — the small caption directly above one control. Subordinate
 * to SectionTitle, one tier above the control itself.
 */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono-num text-[10.5px] uppercase tracking-[0.06em]"
      style={{ color: "var(--ink-faint)" }}
    >
      {children}
    </span>
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

export function Button({
  children,
  variant = "primary",
  block,
  arrow,
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  block?: boolean;
  arrow?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass =
    variant === "primary" ? "btn-primary" : variant === "secondary" ? "btn-secondary" : "btn-ghost";
  return (
    <button
      className={`btn ${variantClass} ${block ? "btn-block" : ""} ${className}`}
      {...rest}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
}

export function Chip({
  children,
  selected,
  onClick,
  className = "",
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`chip ${className}`}
    >
      {children}
    </button>
  );
}

const TIER_GRADIENT: Record<string, string> = {
  entry: "linear-gradient(135deg, #6b6f7d 0%, #35373f 100%)",
  mid: "linear-gradient(135deg, #766efb 0%, #2f24fa 100%)",
  premium: "linear-gradient(135deg, #9a6cf0 0%, #4c1d95 100%)",
  super_premium: "linear-gradient(135deg, #4a3d1f 0%, #14121f 55%, #c9a227 100%)",
};

export function CardVisual({
  name,
  issuer,
  network,
  tier,
  className = "",
}: {
  name: string;
  issuer: string;
  network: string;
  tier: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl p-5 ${className}`}
      style={{ background: TIER_GRADIENT[tier] ?? TIER_GRADIENT.entry, color: "#fff" }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.25), transparent 45%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-[11px] uppercase tracking-[0.08em] opacity-70">{issuer}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-90">
            {network}
          </span>
        </div>
        <div>
          <div
            className="mb-2 h-6 w-9 rounded-[5px]"
            style={{ background: "rgba(255,255,255,0.55)" }}
          />
          <div className="font-serif text-lg leading-tight sm:text-xl">{name}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * A numeric value that's both a slider (fast, approximate) and a typed
 * input (precise) for the same underlying value — never just one or the
 * other.
 */
export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  helper,
  ticks,
}: {
  label: ReactNode;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  helper?: ReactNode;
  ticks?: string[];
}) {
  function clamp(n: number) {
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <div
          className="flex items-center gap-1 font-mono-num text-[15px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          {prefix && <span aria-hidden="true">{prefix}</span>}
          <input
            type="number"
            inputMode="numeric"
            aria-label={typeof label === "string" ? label : undefined}
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="numeric-input w-24"
          />
          {suffix && <span style={{ color: "var(--ink-faint)" }}>{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        aria-label={typeof label === "string" ? `${label} slider` : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {ticks && (
        <div className="mt-1 flex justify-between font-mono-num text-[10px]" style={{ color: "var(--ink-faint)" }}>
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {helper && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
          {helper}
        </p>
      )}
    </div>
  );
}

/**
 * A single-choice tile with an icon, label and short hint — a bigger, more
 * tactile alternative to a plain Chip for a small set of meaningful options
 * (employment type, reward channel).
 */
export function IconTile({
  icon,
  label,
  hint,
  selected,
  onClick,
}: {
  icon: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="rounded-2xl border-2 p-4 text-left transition-colors"
      style={
        selected
          ? { borderColor: "var(--teal)", background: "var(--teal)" }
          : { borderColor: "transparent", background: "var(--paper-raised)" }
      }
    >
      <div
        className="mb-1.5 text-[22px] leading-none"
        style={{ color: selected ? "var(--on-teal)" : "var(--teal)" }}
      >
        {icon}
      </div>
      <div
        className="text-[14px] font-semibold"
        style={{ color: selected ? "var(--on-teal)" : "var(--ink)" }}
      >
        {label}
      </div>
      {hint && (
        <div
          className="mt-0.5 text-[12px]"
          style={{ color: selected ? "var(--on-teal)" : "var(--ink-muted)", opacity: selected ? 0.75 : 1 }}
        >
          {hint}
        </div>
      )}
    </button>
  );
}

/**
 * A whole number with a small bounded range — increment/decrement is a more
 * natural, tactile way to set it than dragging a track (e.g. age).
 */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: ReactNode;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={typeof label === "string" ? `Decrease ${label}` : "Decrease"}
          className="stepper-btn"
        >
          −
        </button>
        <div className="min-w-[4.5rem] text-center font-mono-num text-[28px] font-semibold" style={{ color: "var(--ink)" }}>
          {value}
          {suffix && (
            <span className="ml-1 text-[13px] font-normal" style={{ color: "var(--ink-faint)" }}>
              {suffix}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={typeof label === "string" ? `Increase ${label}` : "Increase"}
          className="stepper-btn"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * A rupee amount with three ways to set it: quick preset chips (fast,
 * approximate), a slider (drag), and a typed number (exact) — all three
 * driving the same value.
 */
export function AmountPicker({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix = "₹",
  presets,
  helper,
}: {
  label: ReactNode;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  presets: { label: string; value: number }[];
  helper?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <Chip key={p.label} selected={value === p.value} onClick={() => onChange(p.value)}>
            {p.label}
          </Chip>
        ))}
      </div>
      <RangeField
        label={label}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        prefix={prefix}
        helper={helper}
      />
    </div>
  );
}

/**
 * Numbered-step progress with labels — replaces plain progress bars so each
 * step reads as a distinct, named stage rather than an anonymous fraction.
 */
export function StepProgress({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <div className="mb-8 flex items-start">
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono-num text-[13px] font-semibold transition-colors"
              style={
                i < current
                  ? { background: "var(--teal)", color: "var(--on-teal)" }
                  : i === current
                    ? { background: "var(--ink)", color: "var(--paper)" }
                    : { border: "1px solid var(--line-strong)", color: "var(--ink-faint)" }
              }
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className="max-w-[5.5rem] text-center text-[11px] leading-tight"
              style={{ color: i <= current ? "var(--ink-muted)" : "var(--ink-faint)" }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mx-2 h-px flex-1 self-start"
              style={{ marginTop: "15px", background: i < current ? "var(--teal)" : "var(--line)" }}
            />
          )}
        </div>
      ))}
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
