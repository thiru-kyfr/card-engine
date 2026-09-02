/**
 * Self-reported credit score bucket — collected client-side only, never sent
 * to the engine and never used to filter results. Purely a display-only
 * likelihood label, per the documented v1 trade-off (README: "Known v1
 * biases — Credit score").
 */
import type { CardTier } from "@/engine/types";

export type CreditScoreBucket = "excellent" | "good" | "fair" | "building" | "unsure";

export const CREDIT_SCORE_OPTIONS: { id: CreditScoreBucket; label: string; hint: string }[] = [
  { id: "excellent", label: "Excellent", hint: "750+" },
  { id: "good", label: "Good", hint: "700–749" },
  { id: "fair", label: "Fair", hint: "650–699" },
  { id: "building", label: "Building", hint: "Below 650" },
  { id: "unsure", label: "Not sure", hint: "Skip this" },
];

const SCORE_RANK: Record<CreditScoreBucket, number> = {
  building: 0,
  fair: 1,
  good: 2,
  excellent: 3,
  unsure: -1,
};

const TIER_RANK: Record<CardTier, number> = {
  entry: 0,
  mid: 1,
  premium: 2,
  super_premium: 3,
};

export function approvalOdds(
  tier: CardTier,
  bucket: CreditScoreBucket,
): { label: string; tone: "teal" | "gold" | "rose" } | null {
  if (bucket === "unsure") return null;
  const diff = SCORE_RANK[bucket] - TIER_RANK[tier];
  if (diff >= 1) return { label: "Strong approval odds", tone: "teal" };
  if (diff === 0) return { label: "Good approval odds", tone: "teal" };
  if (diff === -1) return { label: "Fair approval odds", tone: "gold" };
  return { label: "Low approval odds", tone: "rose" };
}
