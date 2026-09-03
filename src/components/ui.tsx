"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useSpring } from "framer-motion";

const SPRING = { type: "spring" as const, stiffness: 420, damping: 34 };
const SOFT_SPRING = { type: "spring" as const, stiffness: 260, damping: 24 };

/** A number that eases toward its target instead of snapping — used anywhere
 * a value changes from user input (income, NAV) so it reads as alive. */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format: (n: number) => string;
}) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.4 });
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  useMotionValueEvent(spring, "change", (latest) => setDisplay(latest));
  return <>{format(display)}</>;
}

/**
 * A native range input restyled with a gradient fill, a wide grip-handle
 * thumb, and a spring "pop" while actively dragging — the interaction still
 * comes from the browser's own slider (keyboard, touch, a11y all work), only
 * the skin and the tactile feedback are custom.
 */
export function PremiumSlider({
  value,
  onChange,
  min,
  max,
  step,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerDown={() => setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      onKeyDown={() => setActive(true)}
      onKeyUp={() => setActive(false)}
      className={`premium-slider ${active ? "is-active" : ""}`}
      style={{
        background: `linear-gradient(to right, var(--teal) ${pct}%, var(--paper-sunken) ${pct}%)`,
      }}
    />
  );
}

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
    <motion.button
      whileTap={rest.disabled ? undefined : { scale: 0.96 }}
      transition={SPRING}
      className={`btn ${variantClass} ${block ? "btn-block" : ""} ${className}`}
      {...(rest as object)}
    >
      {children}
      {arrow && (
        <motion.span
          aria-hidden="true"
          animate={{ x: [0, 3, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
        >
          →
        </motion.span>
      )}
    </motion.button>
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
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      whileTap={{ scale: 0.94 }}
      animate={selected ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={selected ? { duration: 0.28, ease: "easeOut" } : SPRING}
      className={`chip ${className}`}
    >
      {children}
    </motion.button>
  );
}

const TIER_GRADIENT: Record<string, string> = {
  entry: "linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%)",
  mid: "linear-gradient(135deg, #8b7bff 0%, #2f24fa 100%)",
  premium: "linear-gradient(135deg, #e356e8 0%, #6b21a8 100%)",
  super_premium: "linear-gradient(135deg, #f0cf72 0%, #6b4a12 55%, #2a1f0a 100%)",
};

const TIER_GLOW: Record<string, string> = {
  entry: "rgba(45, 212, 191, 0.35)",
  mid: "rgba(118, 110, 251, 0.4)",
  premium: "rgba(227, 86, 232, 0.35)",
  super_premium: "rgba(240, 207, 114, 0.35)",
};

/** Deterministic hash so the same card always renders the same hue shift —
 * gives cards within a tier real variety instead of looking identical. */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 41) - 20; // -20..20 degrees
}

export function CardVisual({
  name,
  issuer,
  network,
  tier,
  cardId,
  className = "",
}: {
  name: string;
  issuer: string;
  network: string;
  tier: string;
  cardId?: string;
  className?: string;
}) {
  const hue = cardId ? hashHue(cardId) : 0;
  const glow = TIER_GLOW[tier] ?? TIER_GLOW.entry;
  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl p-5 ${className}`}
      style={{
        background: TIER_GRADIENT[tier] ?? TIER_GRADIENT.entry,
        color: "#fff",
        filter: `hue-rotate(${hue}deg) saturate(1.2)`,
        boxShadow: `0 24px 44px -22px ${glow}`,
      }}
    >
      {/* corner highlight */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: "radial-gradient(circle at 85% 12%, rgba(255,255,255,0.4), transparent 45%)",
        }}
      />
      {/* diagonal metallic sheen */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.4) 48%, transparent 62%)",
        }}
      />
      {/* subtle texture so flat tiers don't read as a plain fill */}
      <div
        className="absolute inset-0 opacity-[0.15] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0px, transparent 1.5px, transparent 6px)",
        }}
      />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <span className="text-[11px] uppercase tracking-[0.08em] opacity-80">{issuer}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-95">
            {network}
          </span>
        </div>
        <div>
          <div
            className="mb-2 h-6 w-9 rounded-[5px]"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(255,255,255,0.45))",
            }}
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
      <PremiumSlider
        ariaLabel={typeof label === "string" ? `${label} slider` : undefined}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
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
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      whileTap={{ scale: 0.95 }}
      animate={{
        backgroundColor: selected ? "var(--teal)" : "var(--paper-raised)",
        borderColor: selected ? "var(--teal)" : "transparent",
        scale: selected ? 1 : 1,
      }}
      initial={false}
      transition={SOFT_SPRING}
      className="rounded-2xl border-2 p-4 text-left"
    >
      <motion.div
        className="mb-1.5 text-[22px] leading-none"
        animate={{
          color: selected ? "var(--on-teal)" : "var(--teal)",
          scale: selected ? [1, 1.25, 1] : 1,
        }}
        transition={{ color: SPRING, scale: selected ? { duration: 0.32, ease: "easeOut" } : SPRING }}
      >
        {icon}
      </motion.div>
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
    </motion.button>
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
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          transition={SPRING}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={typeof label === "string" ? `Decrease ${label}` : "Decrease"}
          className="stepper-btn"
        >
          −
        </motion.button>
        <div className="min-w-[4.5rem] text-center font-mono-num text-[28px] font-semibold" style={{ color: "var(--ink)" }}>
          <motion.span
            key={value}
            initial={{ y: value > 0 ? 8 : -8, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={SOFT_SPRING}
            style={{ display: "inline-block" }}
          >
            {value}
          </motion.span>
          {suffix && (
            <span className="ml-1 text-[13px] font-normal" style={{ color: "var(--ink-faint)" }}>
              {suffix}
            </span>
          )}
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          transition={SPRING}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={typeof label === "string" ? `Increase ${label}` : "Increase"}
          className="stepper-btn"
        >
          +
        </motion.button>
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
 * A category dropdown as an animated popover instead of a native <select> —
 * same underlying choice, but the open/close and the current pick both get
 * real motion instead of an instant browser-native swap.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  iconFor,
  ariaLabel,
}: {
  categories: { category_id: string; display_name: string }[];
  value: string;
  onChange: (id: string) => void;
  iconFor: (id: string) => ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = categories.find((c) => c.category_id === value);

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
        className="flex min-w-[200px] flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px]"
        style={{ background: "var(--paper-sunken)", borderColor: "var(--line-strong)", color: "var(--ink)" }}
      >
        <span aria-hidden="true" className="text-[16px] leading-none">
          {iconFor(value)}
        </span>
        <span className="flex-1 truncate text-left">{current?.display_name ?? "Choose a category"}</span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING}
          style={{ color: "var(--ink-faint)" }}
        >
          ⌄
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border p-1.5"
            style={{ background: "var(--paper-raised)", borderColor: "var(--line)", boxShadow: "var(--shadow-md)" }}
          >
            {categories.map((c) => {
              const isSelected = c.category_id === value;
              return (
                <button
                  key={c.category_id}
                  type="button"
                  onClick={() => {
                    onChange(c.category_id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px]"
                  style={{
                    background: isSelected ? "var(--teal-soft)" : "transparent",
                    color: isSelected ? "var(--teal)" : "var(--ink)",
                    fontWeight: isSelected ? 600 : 500,
                  }}
                >
                  <span aria-hidden="true" className="text-[16px] leading-none">
                    {iconFor(c.category_id)}
                  </span>
                  {c.display_name}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
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
            <motion.div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono-num text-[13px] font-semibold"
              initial={false}
              animate={
                i < current
                  ? { background: "var(--teal)", color: "var(--on-teal)", scale: 1 }
                  : i === current
                    ? { background: "var(--ink)", color: "var(--paper)", scale: [1, 1.12, 1] }
                    : { background: "transparent", color: "var(--ink-faint)", scale: 1 }
              }
              transition={i === current ? { scale: { duration: 0.3, ease: "easeOut" }, default: SOFT_SPRING } : SOFT_SPRING}
              style={i > current ? { border: "1px solid var(--line-strong)" } : undefined}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={i < current ? "done" : "num"}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.15 }}
                >
                  {i < current ? "✓" : i + 1}
                </motion.span>
              </AnimatePresence>
            </motion.div>
            <span
              className="max-w-[5.5rem] text-center text-[11px] leading-tight"
              style={{ color: i <= current ? "var(--ink-muted)" : "var(--ink-faint)" }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="relative mx-2 h-px flex-1 self-start overflow-hidden"
              style={{ marginTop: "15px", background: "var(--line)" }}
            >
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: "var(--teal)" }}
                initial={false}
                animate={{ width: i < current ? "100%" : "0%" }}
                transition={SOFT_SPRING}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const GAUGE_COLOR: Record<string, string> = {
  building: "var(--rose)",
  fair: "var(--gold)",
  good: "var(--teal)",
  excellent: "var(--teal)",
  unsure: "var(--ink-muted)",
};

/**
 * A worst-to-best horizontal gauge for a small ordered set of bands (credit
 * score) — a sliding pill (shared-layout animated, so it glides between
 * segments rather than jumping) replaces a flat row of chips.
 */
export function ScoreGauge({
  options,
  order,
  value,
  onChange,
}: {
  options: { id: string; label: string; hint: string }[];
  order: string[];
  value: string;
  onChange: (id: string) => void;
}) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const ordered = order.map((id) => byId.get(id)!).filter(Boolean);
  return (
    <div className="flex gap-1.5 rounded-2xl p-1.5" style={{ background: "var(--paper-sunken)" }}>
      {ordered.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            className="relative flex-1 rounded-xl px-2 py-2.5 text-center"
          >
            {selected && (
              <motion.div
                layoutId="score-gauge-pill"
                className="absolute inset-0 rounded-xl"
                style={{ background: GAUGE_COLOR[o.id] ?? "var(--teal)" }}
                transition={SOFT_SPRING}
              />
            )}
            <span
              className="relative z-10 block text-[12.5px] font-semibold"
              style={{ color: selected ? "var(--on-teal)" : "var(--ink)" }}
            >
              {o.label}
            </span>
            <span
              className="relative z-10 block text-[10px]"
              style={{ color: selected ? "var(--on-teal)" : "var(--ink-faint)", opacity: selected ? 0.8 : 1 }}
            >
              {o.hint}
            </span>
          </button>
        );
      })}
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
