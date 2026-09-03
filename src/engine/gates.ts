/**
 * Stage 1 — hard gates.
 *
 * A gate fires when the card cannot or should not be recommended at all.
 * Every failure carries a human-readable message: "no results" with no reason
 * is a product failure, so the UI always has something to say.
 *
 * v1 deliberately has NO credit-score gate. See README "Known v1 biases".
 */
import type { Card, EngineConfig, GateFailure, UserProfile } from "./types";
import { formatInr } from "./format";

export function runGates(
  card: Card,
  user: UserProfile,
  config: EngineConfig,
  annualSpend: number,
): GateFailure[] {
  const failures: GateFailure[] = [];

  if (card.status !== "active") {
    failures.push({
      code: "STATUS",
      message: `This card is currently ${card.status} and isn't available.`,
    });
    // A non-active card is never shown; no point evaluating further gates.
    return failures;
  }

  if (user.age < card.gates.min_age) {
    failures.push({
      code: "AGE_MIN",
      message: `Minimum age for this card is ${card.gates.min_age}.`,
    });
  }

  if (card.gates.max_age !== undefined && user.age > card.gates.max_age) {
    failures.push({
      code: "AGE_MAX",
      message: `This card is issued up to age ${card.gates.max_age}.`,
    });
  }

  if (!card.gates.allowed_employment.includes(user.employment)) {
    failures.push({
      code: "EMPLOYMENT_FIT",
      message: `Not offered to ${user.employment.replace("_", "-")} applicants.`,
    });
  } else {
    const floor = card.gates.min_income[user.employment];
    if (floor !== undefined && user.annual_income_inr < floor) {
      failures.push({
        code: "INCOME_FLOOR",
        message: `Needs an annual income of at least ${formatInr(floor)}.`,
      });
    }
  }

  // Fee gate. waiver_aware: if the user's declared spend would cross the
  // card's own waiver threshold, the fee is treated as ₹0 here too — the same
  // spend figure that zeroes the fee in the NAV math also clears the gate.
  // (hard_sticker remains available in config for a stricter "budget means
  // budget" mode that ignores waiver reachability entirely.)
  if (card.fee.annual > user.fee_comfort_inr) {
    const waiverReachable =
      card.fee.waiver_threshold !== undefined && annualSpend >= card.fee.waiver_threshold;
    if (config.fee_gate_mode === "hard_sticker" || !waiverReachable) {
      failures.push({
        code: "FEE_COMFORT",
        message: `Annual fee of ${formatInr(card.fee.annual)} is above your ${formatInr(
          user.fee_comfort_inr,
        )} budget.`,
      });
    }
  }

  return failures;
}
