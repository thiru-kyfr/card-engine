/**
 * The engine entry point.
 *
 * A pure function: (catalog, profile) → ranked results. No I/O, no clock beyond
 * a generated_at stamp, no randomness. Same input, same output, always — which
 * is what makes the golden-snapshot tests meaningful.
 */
import type { Catalog, RecommendationResult, CardResult, UserProfile } from "./types";
import { runGates } from "./gates";
import { valueCard } from "./valuation";
import { computeFit } from "./fit";
import { rankResults } from "./rank";
import { explain } from "./explain";

export * from "./types";
export * from "./format";
export { runGates } from "./gates";
export { valueCard, computeCategory, findAccelerator, effectiveMultiplier } from "./valuation";
export { computeFit, accelerates } from "./fit";
export { rankResults } from "./rank";
export { explain } from "./explain";

export function recommend(catalog: Catalog, user: UserProfile): RecommendationResult {
  const { cards, categories, merchants, config } = catalog;

  const monthlySpend =
    user.spend.reduce((s, l) => s + l.monthly_inr, 0) + user.residual_monthly_inr;
  const annualSpend = monthlySpend * 12;

  const warnings: string[] = [];

  // The residual bucket should never be the biggest thing in the vector. If it
  // is, the "top three" are not actually the top three and every accelerator
  // comparison below is built on the wrong shape.
  const largestNamed = user.spend.reduce((m, l) => Math.max(m, l.monthly_inr), 0);
  if (user.residual_monthly_inr > largestNamed && user.residual_monthly_inr > 0) {
    warnings.push(
      "Your 'everything else' spend is larger than any category you named. Adding a fourth category would make this recommendation noticeably more accurate.",
    );
  }

  if (monthlySpend <= 0) {
    warnings.push("No spend entered, so every card values at zero minus its fee.");
  }

  if (user.annual_income_inr > 0 && annualSpend > user.annual_income_inr * 0.8) {
    warnings.push(
      "Your stated card spend is more than 80% of your income — worth double-checking the amounts.",
    );
  }

  const evaluated: CardResult[] = cards.map((card) => {
    const failures = runGates(card, user, config, annualSpend);
    if (failures.length > 0) {
      return { card, eligible: false, gate_failures: failures };
    }
    const valuation = valueCard(card, user, config, categories);
    const fit = computeFit(card, user, config, merchants);
    return { card, eligible: true, gate_failures: [], valuation, fit };
  });

  const eligible = evaluated.filter((r) => r.eligible);
  const gated = evaluated
    .filter((r) => !r.eligible)
    // Hide discontinued/draft cards entirely — they are a catalog state, not a
    // rejection the user needs explained.
    .filter((r) => !r.gate_failures.some((f) => f.code === "STATUS"));

  const ranked = rankResults(eligible, config);
  for (const r of ranked) {
    r.explanation = explain(r, user);
  }

  if (ranked.length === 0) {
    warnings.push(
      "No card in the catalog matches your eligibility and fee constraints. Raising the fee budget is usually what unlocks the most options.",
    );
  }

  return {
    ranked,
    gated,
    warnings,
    meta: {
      total_monthly_spend: monthlySpend,
      total_annual_spend: annualSpend,
      cards_evaluated: evaluated.length,
      tiebreak_band_pct: config.tiebreak_band_pct,
      generated_at: new Date().toISOString(),
    },
  };
}
