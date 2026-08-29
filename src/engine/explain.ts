/**
 * Turns a result's breakdown into sentences.
 *
 * Generated from the SAME object that produced the rank — never written
 * separately — so the explanation cannot drift from the arithmetic.
 */
import type { CardResult, UserProfile } from "./types";
import { formatInr, formatPoints } from "./format";

const CHANNEL_LABEL: Record<string, string> = {
  cashback: "cashback",
  voucher: "vouchers",
  portal: "the travel portal",
  airmiles: "airline miles",
  merchandise: "the merchandise catalogue",
};

export function explain(result: CardResult, user: UserProfile): string[] {
  const v = result.valuation;
  if (!v) return [];
  const out: string[] = [];

  out.push(
    `Worth ${formatInr(v.nav_inr)} a year to you, net of everything this card costs.`,
  );

  const boosted = v.categories.filter((c) => c.effective_multiplier > 1 && c.monthly_points > 0);
  if (boosted.length > 0) {
    const parts = boosted.map(
      (c) => `${c.effective_multiplier}× on ${c.display_name.toLowerCase()}`,
    );
    out.push(`Accelerated where you spend: ${parts.join(", ")}.`);
  } else {
    out.push(
      `No bonus categories match your spend — this earns the base rate everywhere.`,
    );
  }

  const capped = v.categories.filter((c) => c.cap_hit);
  for (const c of capped) {
    out.push(
      `Your ${c.display_name.toLowerCase()} spend passes the cap${
        c.cap_label ? ` (${c.cap_label})` : ""
      }: ${formatInr(c.eligible_spend)} earns the bonus rate, the other ${formatInr(
        c.overflow_spend,
      )} drops to base.`,
    );
  }

  const excluded = v.categories.filter((c) => c.excluded === "zero_earn" && c.monthly_spend > 0);
  if (excluded.length > 0) {
    out.push(
      `Earns nothing on ${excluded
        .map((c) => c.display_name.toLowerCase())
        .join(" or ")} — excluded by this card.`,
    );
  }

  out.push(
    `${formatPoints(v.monthly_points)} points a month, redeemed as ${
      CHANNEL_LABEL[v.channel] ?? v.channel
    } at ₹${v.inr_per_point.toFixed(2)} a point.`,
  );

  if (v.channel_was_fallback) {
    out.push(
      `Note: this card does not offer ${
        CHANNEL_LABEL[user.preferred_channel] ?? user.preferred_channel
      }, so it has been valued at its ${CHANNEL_LABEL[v.channel] ?? v.channel} rate instead.`,
    );
  }

  if (v.milestones_hit.length > 0) {
    out.push(
      `Your annual spend clears ${v.milestones_hit.length === 1 ? "a milestone" : "milestones"}: ${v.milestones_hit
        .map((m) => `${formatInr(m.value_inr)} at ${formatInr(m.threshold)}`)
        .join(", ")}.`,
    );
  }

  if (v.effective_fee_inr === 0 && v.fee_waived) {
    out.push(
      `The ${formatInr(result.card.fee.annual)} annual fee is waived at your spend level.`,
    );
  } else if (v.effective_fee_inr > 0) {
    out.push(
      `Costs ${formatInr(v.effective_fee_inr)} a year in fees, including GST.` +
        (result.card.fee.waiver_threshold !== undefined
          ? ` It would be waived at ${formatInr(result.card.fee.waiver_threshold)} of annual spend.`
          : ""),
    );
  }

  if (v.forex_cost_inr > 0) {
    out.push(
      `Your international spend carries ${formatInr(v.forex_cost_inr)} a year in forex markup at ${result.card.forex_markup_pct}%.`,
    );
  }

  if (v.welcome_bonus_inr > 0) {
    out.push(
      `First year only: a welcome bonus worth about ${formatInr(v.welcome_bonus_inr)}${
        result.card.welcome?.condition ? ` (${result.card.welcome.condition})` : ""
      }. Not counted in the figure above.`,
    );
  }

  if (result.tiebreak_applied) {
    out.push(
      `Ranked ahead of a card with slightly higher value because it better matches your biggest spend categories — within 10%, the money difference is smaller than the engine's own margin of error.`,
    );
  }

  return out;
}
