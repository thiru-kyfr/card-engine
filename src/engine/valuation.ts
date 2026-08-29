/**
 * Stages 3–4 — valuation, in five layers.
 *
 * Every intermediate stays in a unit you can say out loud: points, then rupees
 * per month, then rupees per year. The output (NAV) is real money, which is what
 * makes the ranking testable and arguable.
 *
 * L1  points per category, respecting caps and exclusions
 * L2  points → rupees via the user's redemption channel
 * L3  annualize, add spend milestones
 * L4  subtract effective fee and forex cost  →  NAV
 */
import type {
  Accelerator,
  Card,
  CategoryBreakdown,
  Category,
  EngineConfig,
  Exclusion,
  MilestoneHit,
  RedemptionChannel,
  RedemptionOption,
  UserProfile,
  Valuation,
} from "./types";
import { formatInr, formatPoints, round2 } from "./format";

/** The residual "everything else" bucket always uses this category id. */
export const RESIDUAL_CATEGORY_ID = "other";
/** Named category that triggers forex markup rather than an MCC lookup. */
export const INTERNATIONAL_CATEGORY_ID = "international";

/**
 * `total` basis: "5X" means 5x base overall.
 * `additional` basis: "5X" is added on top of base, so the user earns 6x.
 * Card marketing is genuinely ambiguous here; the catalog must state which.
 */
export function effectiveMultiplier(a: Accelerator): number {
  return a.basis === "additional" ? 1 + a.multiplier : a.multiplier;
}

/**
 * How much monthly spend qualifies for the bonus rate.
 *
 * The user does not hold this card, so every month starts with the FULL cap
 * available — there is no consumed-cap state to carry. A points cap is
 * back-solved into the equivalent qualifying spend.
 */
export function eligibleSpendUnderCap(
  monthlySpend: number,
  card: Card,
  accel: Accelerator,
): { eligible: number; capLabel?: string } {
  const mult = effectiveMultiplier(accel);
  if (accel.cap.type === "none" || accel.cap.value === undefined) {
    return { eligible: monthlySpend };
  }
  if (accel.cap.type === "spend") {
    return {
      eligible: Math.min(monthlySpend, accel.cap.value),
      capLabel: `${formatInr(accel.cap.value)} of spend / ${humanWindow(accel.cap.window)}`,
    };
  }
  // points cap → maximum spend that can generate that many bonus points
  const pointsPerRupee = (card.base.points_per_unit / card.base.unit_inr) * mult;
  const maxSpend = pointsPerRupee > 0 ? accel.cap.value / pointsPerRupee : 0;
  return {
    eligible: Math.min(monthlySpend, maxSpend),
    capLabel: `${formatPoints(accel.cap.value)} points / ${humanWindow(accel.cap.window)}`,
  };
}

function humanWindow(w: string): string {
  switch (w) {
    case "statement_cycle":
      return "statement cycle";
    case "calendar_month":
      return "month";
    case "quarter":
      return "quarter";
    case "year":
      return "year";
    default:
      return w;
  }
}

/** Picks the accelerator that applies to a category: lowest priority number wins. */
export function findAccelerator(card: Card, categoryId: string): Accelerator | undefined {
  const matches = card.accelerators.filter(
    (a) => a.scope.type === "category" && a.scope.value === categoryId,
  );
  if (matches.length === 0) return undefined;
  return [...matches].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))[0];
}

function findExclusion(card: Card, categoryId: string): Exclusion | undefined {
  return card.exclusions.find((e) => e.category === categoryId);
}

/** L1 — points earned in one category, in one month. */
export function computeCategory(
  card: Card,
  categoryId: string,
  monthlySpend: number,
  displayName: string,
): CategoryBreakdown {
  const base: CategoryBreakdown = {
    category_id: categoryId,
    display_name: displayName,
    monthly_spend: monthlySpend,
    effective_multiplier: 1,
    eligible_spend: 0,
    overflow_spend: monthlySpend,
    cap_hit: false,
    monthly_points: 0,
  };

  if (monthlySpend <= 0) return { ...base, overflow_spend: 0 };

  const exclusion = findExclusion(card, categoryId);
  const pointsPerRupee = card.base.points_per_unit / card.base.unit_inr;

  // zero_earn: the category earns nothing at all.
  if (exclusion?.treatment === "zero_earn") {
    return { ...base, excluded: "zero_earn", effective_multiplier: 0, monthly_points: 0 };
  }

  // base_only: earns the base rate but never an accelerator.
  if (exclusion?.treatment === "base_only") {
    return {
      ...base,
      excluded: "base_only",
      monthly_points: round2(monthlySpend * pointsPerRupee),
    };
  }

  const accel = findAccelerator(card, categoryId);
  if (!accel) {
    return { ...base, monthly_points: round2(monthlySpend * pointsPerRupee) };
  }

  const mult = effectiveMultiplier(accel);
  const { eligible, capLabel } = eligibleSpendUnderCap(monthlySpend, card, accel);
  const overflow = Math.max(0, monthlySpend - eligible);
  const points = eligible * pointsPerRupee * mult + overflow * pointsPerRupee * accel.post_cap;

  return {
    category_id: categoryId,
    display_name: displayName,
    monthly_spend: monthlySpend,
    rule_id: accel.id,
    effective_multiplier: mult,
    eligible_spend: round2(eligible),
    overflow_spend: round2(overflow),
    cap_hit: overflow > 0.01,
    cap_label: capLabel,
    monthly_points: round2(points),
  };
}

/**
 * L2 — which redemption channel this user gets, and at what rate.
 * Falls back to the card's default channel, then to its best-paying one.
 */
export function pickChannel(
  card: Card,
  preferred: RedemptionChannel,
): { option: RedemptionOption; wasFallback: boolean } {
  const exact = card.redemption.find((r) => r.channel === preferred);
  if (exact) return { option: exact, wasFallback: false };
  const def = card.redemption.find((r) => r.is_default);
  if (def) return { option: def, wasFallback: true };
  const best = [...card.redemption].sort((a, b) => b.inr_per_point - a.inr_per_point)[0];
  return { option: best, wasFallback: true };
}

/** L3 — spend milestones that actually fire at this user's annual spend. */
export function computeMilestones(card: Card, annualSpend: number): MilestoneHit[] {
  const reached = card.milestones.filter((m) => annualSpend >= m.threshold);
  if (reached.length === 0) return [];
  const anyNonCumulative = reached.some((m) => !m.cumulative);
  const chosen = anyNonCumulative
    ? [reached.reduce((hi, m) => (m.threshold > hi.threshold ? m : hi))]
    : reached;
  return chosen.map((m) => ({
    id: m.id,
    threshold: m.threshold,
    value_inr: m.value_inr,
    notes: m.notes,
  }));
}

/** Full valuation for one card against one profile. */
export function valueCard(
  card: Card,
  user: UserProfile,
  config: EngineConfig,
  categories: Category[],
): Valuation {
  const nameOf = (id: string) =>
    categories.find((c) => c.category_id === id)?.display_name ?? id;

  // ── L1 ────────────────────────────────────────────────────────────
  const lines: CategoryBreakdown[] = [];
  for (const line of user.spend) {
    if (line.monthly_inr <= 0) continue;
    lines.push(computeCategory(card, line.category_id, line.monthly_inr, nameOf(line.category_id)));
  }
  if (user.residual_monthly_inr > 0) {
    // residual_treatment is base_rate in v1: the bucket never earns an accelerator.
    lines.push(
      computeCategory(
        card,
        RESIDUAL_CATEGORY_ID,
        user.residual_monthly_inr,
        "Everything else",
      ),
    );
  }
  const monthlyPoints = round2(lines.reduce((s, l) => s + l.monthly_points, 0));

  // ── L2 ────────────────────────────────────────────────────────────
  const { option, wasFallback } = pickChannel(card, user.preferred_channel);
  const friction = config.redemption_friction_enabled
    ? config.redemption_friction[option.channel] ?? 1
    : 1;
  const monthlyValue = round2(monthlyPoints * option.inr_per_point * friction);

  // ── L3 ────────────────────────────────────────────────────────────
  const monthlySpend = user.spend.reduce((s, l) => s + l.monthly_inr, 0) + user.residual_monthly_inr;
  const annualSpend = monthlySpend * 12;
  const annualRewards = round2(monthlyValue * 12);
  const milestonesHit = computeMilestones(card, annualSpend);
  const milestoneValue = round2(milestonesHit.reduce((s, m) => s + m.value_inr, 0));
  const gross = round2(annualRewards + milestoneValue);

  // ── L4 ────────────────────────────────────────────────────────────
  const feeWaived =
    card.fee.waiver_threshold !== undefined && annualSpend >= card.fee.waiver_threshold;
  const gstPct = card.fee.gst_pct ?? config.gst_pct;
  const effectiveFee = feeWaived ? 0 : round2(card.fee.annual * (1 + gstPct / 100));

  const intlLine = user.spend.find((l) => l.category_id === INTERNATIONAL_CATEGORY_ID);
  const intlAnnual = (intlLine?.monthly_inr ?? 0) * 12;
  const forexCost = round2(intlAnnual * (card.forex_markup_pct / 100));

  const nav = round2(gross - effectiveFee - forexCost);

  // Reported separately — never inside NAV unless explicitly configured.
  const welcomeBonus = round2((card.welcome?.points ?? 0) * option.inr_per_point * friction);

  return {
    categories: lines,
    monthly_points: monthlyPoints,
    channel: option.channel,
    channel_was_fallback: wasFallback,
    inr_per_point: option.inr_per_point,
    friction_factor: friction,
    monthly_value_inr: monthlyValue,
    annual_rewards_inr: annualRewards,
    milestones_hit: milestonesHit,
    milestone_value_inr: milestoneValue,
    gross_annual_inr: gross,
    annual_spend_inr: annualSpend,
    fee_waived: feeWaived,
    effective_fee_inr: effectiveFee,
    forex_cost_inr: forexCost,
    nav_inr: config.welcome_bonus_in_nav ? round2(nav + welcomeBonus) : nav,
    welcome_bonus_inr: welcomeBonus,
  };
}
