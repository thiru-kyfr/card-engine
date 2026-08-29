/**
 * Fit score — the ONLY place positional category weighting belongs.
 *
 * The rupee amounts already carry the weighting in NAV: ₹20,000 of dining
 * influences the result four times as much as ₹5,000 of travel because it
 * generates four times the points. Applying a positional multiplier there
 * would double-count the ranking and stop NAV being real money.
 *
 * Here, where we are breaking a tie rather than measuring money, blunt rank
 * weights (3 / 2 / 1) are exactly right: stable against small errors in
 * self-reported amounts, and easy to explain.
 */
import type { Card, EngineConfig, FitScore, Merchant, UserProfile } from "./types";
import { findAccelerator } from "./valuation";
import { round2 } from "./format";

/** Does this card give a bonus rate on this category (and not exclude it)? */
export function accelerates(card: Card, categoryId: string): boolean {
  const excluded = card.exclusions.find((e) => e.category === categoryId);
  if (excluded) return false;
  return findAccelerator(card, categoryId) !== undefined;
}

export function computeFit(
  card: Card,
  user: UserProfile,
  config: EngineConfig,
  merchants: Merchant[],
): FitScore {
  // Rank the user's named categories by amount, descending. Position, not size,
  // is what earns the weight here.
  const ranked = [...user.spend]
    .filter((l) => l.monthly_inr > 0)
    .sort((a, b) => b.monthly_inr - a.monthly_inr || a.category_id.localeCompare(b.category_id));

  const weights = [config.rank_weight_1, config.rank_weight_2, config.rank_weight_3];

  let weightSum = 0;
  let covered = 0;
  const coveredCategories: string[] = [];
  ranked.slice(0, weights.length).forEach((line, i) => {
    const w = weights[i];
    weightSum += w;
    if (accelerates(card, line.category_id)) {
      covered += w;
      coveredCategories.push(line.category_id);
    }
  });
  const categoryCoverage = weightSum > 0 ? covered / weightSum : 0;

  // Does the card actually offer the channel the user asked for?
  const rewardTypeMatch = card.redemption.some((r) => r.channel === user.preferred_channel) ? 1 : 0;

  // Merchant overlap: a named merchant counts when the card is its co-brand, or
  // when the card accelerates the category that merchant sits in.
  let matchedMerchants: string[] = [];
  if (user.frequent_merchants.length > 0) {
    matchedMerchants = user.frequent_merchants.filter((id) => {
      const m = merchants.find((x) => x.merchant_id === id);
      if (!m) return false;
      if (m.has_cobrand_card && m.cobrand_card_id === card.card_id) return true;
      return accelerates(card, m.category_id);
    });
  }
  const merchantOverlap =
    user.frequent_merchants.length > 0
      ? matchedMerchants.length / user.frequent_merchants.length
      : 0;

  // When no merchants were named, redistribute that weight onto the other two
  // signals so cards are not all uniformly penalised for a skipped question.
  const wCat = config.fit_weight_category_coverage;
  const wRew = config.fit_weight_reward_type_match;
  const wMer = config.fit_weight_merchant_overlap;
  const merchantAsked = user.frequent_merchants.length > 0;
  const denom = merchantAsked ? wCat + wRew + wMer : wCat + wRew;

  const total =
    denom > 0
      ? (categoryCoverage * wCat +
          rewardTypeMatch * wRew +
          (merchantAsked ? merchantOverlap * wMer : 0)) /
        denom
      : 0;

  return {
    category_coverage: round2(categoryCoverage),
    reward_type_match: rewardTypeMatch,
    merchant_overlap: round2(merchantOverlap),
    total: round2(total),
    covered_categories: coveredCategories,
    matched_merchants: matchedMerchants,
  };
}
