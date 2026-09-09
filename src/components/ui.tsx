"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useSpring } from "framer-motion";
import { Check } from "lucide-react";

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
          : "transparent";
  return (
    <div
      className={`glass rounded-2xl border ${className}`}
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
    <div className="mb-4 sm:mb-5">
      <h2 className="text-[17px] font-normal leading-snug sm:text-[18px]" style={{ color: "var(--ink)" }}>
        {children}
      </h2>
      {description && (
        <p
          className="mt-1 text-[12.5px] leading-snug sm:mt-1.5 sm:text-[13.5px]"
          style={{ color: "var(--ink-muted)" }}
        >
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

/** The four card tiers map onto KYFR's own brand-spectrum stops, in the same
 * order the logo gradient uses them (violet → pink → magenta → amber) — so
 * "higher tier" reads as "further along the brand gradient," not an
 * unrelated color choice. */
const TIER_GRADIENT: Record<string, string> = {
  entry: "var(--tile-violet)",
  mid: "var(--tile-pink)",
  premium: "var(--tile-magenta)",
  super_premium: "var(--tile-amber)",
};

const TIER_GLOW: Record<string, string> = {
  entry: "rgba(128, 72, 240, 0.4)",
  mid: "rgba(255, 107, 161, 0.35)",
  premium: "rgba(249, 125, 214, 0.35)",
  super_premium: "rgba(255, 195, 102, 0.35)",
};

/** Deterministic hash so the same card always renders the same subtle hue
 * shift — enough variety within a tier without drifting off the brand hue
 * (KYFR reserves the spectrum for rare emphasis, so the range stays tight). */
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 13) - 6; // -6..6 degrees
}

/** Real card art, supplied by the design team, for the issuers it covers.
 * Everything else falls back to the tier-gradient treatment above — there's
 * no art asset for every issuer in the catalog, and a missing one should
 * degrade gracefully rather than show a broken image. */
const ISSUER_ART: Record<string, string> = {
  "Axis Bank": "/card-art/axis.png",
  "HDFC Bank": "/card-art/hdfc.png",
  "SBI Card": "/card-art/sbi.png",
  "ICICI Bank": "/card-art/icici.png",
  "IDFC FIRST Bank": "/card-art/idfc-first.png",
  BOBCARD: "/card-art/bank-of-baroda.png",
  "YES Bank": "/card-art/yes-bank.png",
  "Kotak Mahindra Bank": "/card-art/kotak.png",
  "IndusInd Bank": "/card-art/indusind.png",
};

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
  const art = ISSUER_ART[issuer];

  return (
    <div
      className={`relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl p-5 ${className}`}
      style={{
        background: art ? "#0a0410" : TIER_GRADIENT[tier] ?? TIER_GRADIENT.entry,
        color: "#fff",
        filter: art ? undefined : `hue-rotate(${hue}deg) saturate(1.2)`,
        boxShadow: art ? "0 24px 44px -22px rgba(0,0,0,0.55)" : `0 24px 44px -22px ${glow}`,
      }}
    >
      {art ? (
        <>
          <Image src={art} alt="" fill sizes="320px" className="object-cover" priority={false} />
          {/* scrim so the issuer/network/name text stays legible over any
           * photo art, regardless of how bright that particular design is */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.02) 32%, rgba(0,0,0,0.02) 58%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </>
      ) : (
        <>
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
        </>
      )}
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
          className="flex items-center gap-1 font-mono-num text-[15px] font-normal"
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
        backgroundColor: selected ? "var(--gold-soft)" : "var(--paper-raised)",
        borderColor: selected ? "var(--gold)" : "transparent",
        scale: selected ? 1 : 1,
      }}
      initial={false}
      transition={SOFT_SPRING}
      className="glass rounded-2xl border-2 p-3 text-left sm:p-4"
    >
      <div
        className="icon-chip mb-1.5 h-9 w-9 sm:mb-2 sm:h-11 sm:w-11"
        style={{ background: selected ? "transparent" : "var(--violet-deepbg)", color: selected ? "var(--gold)" : "var(--teal)" }}
      >
        {icon}
      </div>
      <div
        className="text-[12.5px] font-normal leading-tight sm:text-[14px]"
        style={{ color: selected ? "var(--gold)" : "var(--ink)" }}
      >
        {label}
      </div>
      {/* The hint is genuine help on a wide tile, but at three-across on a
          phone it turns the tile into a wall of 9pt text — the label alone
          carries the choice there. */}
      {hint && (
        <div
          className="mt-0.5 hidden text-[12px] sm:block"
          style={{ color: selected ? "var(--gold)" : "var(--ink-muted)", opacity: selected ? 0.75 : 1 }}
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
        <div className="min-w-[4.5rem] text-center font-mono-num text-[28px] font-light" style={{ color: "var(--ink)" }}>
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
      <div className="mb-3 flex flex-wrap gap-1.5 sm:gap-2">
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
    <div className="mb-5 flex items-start">
      {steps.map((s, i) => (
        <div key={s} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1">
            <motion.div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono-num text-[11px] font-semibold"
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
                  {i < current ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : i + 1}
                </motion.span>
              </AnimatePresence>
            </motion.div>
            <span
              className="max-w-[5.5rem] text-center text-[10px] leading-tight"
              style={{ color: i <= current ? "var(--ink-muted)" : "var(--ink-faint)" }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="relative mx-2 h-px flex-1 self-start overflow-hidden"
              style={{ marginTop: "11px", background: "var(--line)" }}
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
    <div
      className="grid grid-cols-3 gap-1.5 rounded-2xl p-1.5 sm:flex"
      style={{ background: "var(--paper-sunken)" }}
    >
      {ordered.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={selected}
            className="relative rounded-xl px-2 py-2.5 text-center sm:flex-1"
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
              className="relative z-10 block text-[12.5px] font-medium"
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

/**
 * A real "back" — returns to whatever page the user actually came from
 * (browser history), rather than a hardcoded destination. A Link to a fixed
 * URL is wrong here: someone arriving at a card's detail page from search
 * results should land back on those results, not always on the full catalog.
 */
export function BackButton({
  fallbackHref = "/catalog",
  label = "← Back",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="bg-transparent p-0 text-[13px]"
      style={{ color: "var(--teal)", border: "none", cursor: "pointer", font: "inherit" }}
    >
      {label}
    </button>
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
