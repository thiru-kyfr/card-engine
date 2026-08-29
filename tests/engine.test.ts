import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { cardSchema, categorySchema, engineConfigSchema, merchantSchema } from "../src/engine/schema";
import { recommend } from "../src/engine";
import {
  computeCategory,
  effectiveMultiplier,
  eligibleSpendUnderCap,
  pickChannel,
  computeMilestones,
} from "../src/engine/valuation";
import { rankResults } from "../src/engine/rank";
import { computeFit } from "../src/engine/fit";
import type { Card, Catalog, UserProfile, CardResult, EngineConfig } from "../src/engine/types";

const ROOT = path.join(__dirname, "..");

function loadCatalog(): Catalog {
  const config = engineConfigSchema.parse(
    parseYaml(readFileSync(path.join(ROOT, "catalog/engine.config.yaml"), "utf8")),
  ) as EngineConfig;
  const categories = parseYaml(readFileSync(path.join(ROOT, "catalog/categories.yaml"), "utf8")).map(
    (c: unknown) => categorySchema.parse(c),
  );
  const merchants = parseYaml(readFileSync(path.join(ROOT, "catalog/merchants.yaml"), "utf8")).map(
    (m: unknown) => merchantSchema.parse(m),
  );
  const dir = path.join(ROOT, "catalog/cards");
  const cards = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => cardSchema.parse(parseYaml(readFileSync(path.join(dir, f), "utf8"))) as Card);
  return { cards, categories, merchants, config } as Catalog;
}

const catalog = loadCatalog();
const card = (id: string) => catalog.cards.find((c) => c.card_id === id)!;

const baseUser: UserProfile = {
  age: 30,
  employment: "salaried",
  annual_income_inr: 1200000,
  spend: [
    { category_id: "dining", monthly_inr: 8000 },
    { category_id: "online_shopping", monthly_inr: 12000 },
    { category_id: "travel_air", monthly_inr: 5000 },
  ],
  residual_monthly_inr: 15000,
  preferred_channel: "voucher",
  fee_comfort_inr: 5000,
  frequent_merchants: [],
};

/* ─────────────────────────── catalog integrity ─────────────────────── */

describe("catalog", () => {
  it("every card parses against the schema", () => {
    expect(catalog.cards.length).toBeGreaterThanOrEqual(10);
  });

  it("every accelerator targets a real category", () => {
    const ids = new Set(catalog.categories.map((c) => c.category_id));
    for (const c of catalog.cards) {
      for (const a of c.accelerators) {
        if (a.scope.type === "category") expect(ids.has(a.scope.value)).toBe(true);
      }
    }
  });

  it("every card has exactly one default redemption channel", () => {
    for (const c of catalog.cards) {
      expect(c.redemption.filter((r) => r.is_default).length).toBe(1);
    }
  });

  it("defines the residual category", () => {
    expect(catalog.categories.some((c) => c.category_id === "other")).toBe(true);
  });

  it("every merchant cobrand_card_id resolves to a real card", () => {
    const ids = new Set(catalog.cards.map((c) => c.card_id));
    for (const m of catalog.merchants) {
      if (m.cobrand_card_id) expect(ids.has(m.cobrand_card_id)).toBe(true);
    }
  });
});

/* ─────────────────────────── L1: points math ───────────────────────── */

describe("L1 — points per category", () => {
  it("applies base rate with no accelerator", () => {
    // everyday-cashback: 1 pt per ₹100, no dining accelerator
    const r = computeCategory(card("everyday-cashback"), "dining", 8000, "Dining");
    expect(r.monthly_points).toBe(80);
    expect(r.effective_multiplier).toBe(1);
  });

  it("applies a spend cap and drops overflow to the post-cap rate", () => {
    // everyday-cashback: 5x on online, cap ₹10,000 spend, post_cap 1
    const r = computeCategory(card("everyday-cashback"), "online_shopping", 12000, "Online");
    // 10000/100*1*5 = 500  +  2000/100*1*1 = 20
    expect(r.monthly_points).toBe(520);
    expect(r.eligible_spend).toBe(10000);
    expect(r.overflow_spend).toBe(2000);
    expect(r.cap_hit).toBe(true);
  });

  it("back-solves a points cap into qualifying spend", () => {
    // rewards-multiplier: 2 pts/₹150, 10x dining, cap 2500 POINTS
    // pointsPerRupee = 2/150*10 = 0.13333 → maxSpend = 2500/0.13333 = ₹18,750
    const c = card("rewards-multiplier");
    const { eligible } = eligibleSpendUnderCap(30000, c, c.accelerators.find((a) => a.id === "rm-dining")!);
    expect(Math.round(eligible)).toBe(18750);
    const r = computeCategory(c, "dining", 30000, "Dining");
    // 2500 bonus points + overflow 11250/150*2*1 = 150
    expect(Math.round(r.monthly_points)).toBe(2650);
  });

  it("stops earning entirely when post_cap is 0", () => {
    // axis-shop-plus: 10x online, cap 4000 points, post_cap 0
    const c = card("axis-shop-plus");
    const r = computeCategory(c, "online_shopping", 50000, "Online");
    // pointsPerRupee 2/100*10 = 0.2 → maxSpend = 20000. Overflow earns NOTHING.
    expect(r.monthly_points).toBe(4000);
    expect(r.overflow_spend).toBe(30000);
  });

  it("honours an uncapped accelerator", () => {
    const c = card("apex-infinite");
    const r = computeCategory(c, "travel_air", 200000, "Flights");
    // 3 pts/₹100 * 5 = 0.15/rupee, uncapped
    expect(r.monthly_points).toBe(30000);
    expect(r.cap_hit).toBe(false);
  });

  it("zero_earn exclusions earn nothing", () => {
    const r = computeCategory(card("rewards-multiplier"), "rent", 40000, "Rent");
    expect(r.monthly_points).toBe(0);
    expect(r.excluded).toBe("zero_earn");
  });

  it("base_only exclusions earn base rate but never an accelerator", () => {
    const r = computeCategory(card("rewards-multiplier"), "insurance", 15000, "Insurance");
    expect(r.monthly_points).toBe(200); // 15000/150*2
    expect(r.excluded).toBe("base_only");
  });

  it("multiplier basis 'additional' adds on top of base", () => {
    const total = { basis: "total", multiplier: 5 } as never;
    const additional = { basis: "additional", multiplier: 5 } as never;
    expect(effectiveMultiplier(total)).toBe(5);
    expect(effectiveMultiplier(additional)).toBe(6);
  });

  it("zero spend produces zero points and no overflow", () => {
    const r = computeCategory(card("rewards-multiplier"), "dining", 0, "Dining");
    expect(r.monthly_points).toBe(0);
    expect(r.overflow_spend).toBe(0);
  });
});

/* ─────────────────────────── L2: redemption ────────────────────────── */

describe("L2 — redemption channel", () => {
  it("uses the preferred channel when offered", () => {
    const { option, wasFallback } = pickChannel(card("rewards-multiplier"), "airmiles");
    expect(option.channel).toBe("airmiles");
    expect(wasFallback).toBe(false);
  });

  it("falls back to the default channel when not offered", () => {
    // everyday-cashback offers cashback only
    const { option, wasFallback } = pickChannel(card("everyday-cashback"), "airmiles");
    expect(option.channel).toBe("cashback");
    expect(wasFallback).toBe(true);
  });
});

/* ─────────────────────────── L3/L4 ─────────────────────────────────── */

describe("L3/L4 — milestones, fee, forex", () => {
  it("fires cumulative milestones at or above threshold", () => {
    const hits = computeMilestones(card("travel-elite"), 900000);
    expect(hits.map((h) => h.id).sort()).toEqual(["te-ms1", "te-ms2"]);
  });

  it("fires nothing below the first threshold", () => {
    expect(computeMilestones(card("travel-elite"), 100000)).toHaveLength(0);
  });

  it("waives the fee at or above the waiver threshold", () => {
    const rich: UserProfile = { ...baseUser, spend: [{ category_id: "dining", monthly_inr: 30000 }], residual_monthly_inr: 0 };
    const res = recommend(catalog, { ...rich, fee_comfort_inr: 50000 });
    const rm = res.ranked.find((r) => r.card.card_id === "rewards-multiplier")!;
    expect(rm.valuation!.annual_spend_inr).toBe(360000); // > 300000 waiver
    expect(rm.valuation!.fee_waived).toBe(true);
    expect(rm.valuation!.effective_fee_inr).toBe(0);
  });

  it("charges fee plus GST when the waiver is not reached", () => {
    const res = recommend(catalog, { ...baseUser, fee_comfort_inr: 50000, spend: [{ category_id: "dining", monthly_inr: 1000 }], residual_monthly_inr: 0 });
    const rm = res.ranked.find((r) => r.card.card_id === "rewards-multiplier")!;
    expect(rm.valuation!.effective_fee_inr).toBe(2950); // 2500 * 1.18
  });

  it("applies forex markup to international spend only", () => {
    const u: UserProfile = {
      ...baseUser,
      fee_comfort_inr: 50000,
      annual_income_inr: 5000000, // clear travel-elite's ₹18L floor
      spend: [{ category_id: "international", monthly_inr: 10000 }],
      residual_monthly_inr: 0,
    };
    const res = recommend(catalog, u);
    const te = res.ranked.find((r) => r.card.card_id === "travel-elite")!;
    // 10000*12 = 120000 annual * 2.0% = 2400
    expect(te.valuation!.forex_cost_inr).toBe(2400);
    const ec = res.ranked.find((r) => r.card.card_id === "everyday-cashback")!;
    expect(ec.valuation!.forex_cost_inr).toBe(4200); // 3.5%
  });

  it("keeps the welcome bonus out of NAV", () => {
    const res = recommend(catalog, { ...baseUser, fee_comfort_inr: 50000 });
    const rm = res.ranked.find((r) => r.card.card_id === "rewards-multiplier")!;
    expect(rm.valuation!.welcome_bonus_inr).toBeGreaterThan(0);
    const recomputed =
      rm.valuation!.gross_annual_inr - rm.valuation!.effective_fee_inr - rm.valuation!.forex_cost_inr;
    expect(rm.valuation!.nav_inr).toBeCloseTo(recomputed, 2);
  });
});

/* ─────────────────────────── gates ─────────────────────────────────── */

describe("gates", () => {
  it("drops a card whose sticker fee exceeds the budget, waiver notwithstanding", () => {
    const res = recommend(catalog, baseUser); // fee comfort ₹5,000
    const te = res.gated.find((r) => r.card.card_id === "travel-elite")!;
    expect(te.gate_failures.some((f) => f.code === "FEE_COMFORT")).toBe(true);
  });

  it("drops a card below the income floor", () => {
    const res = recommend(catalog, { ...baseUser, annual_income_inr: 100000, fee_comfort_inr: 100000 });
    const te = res.gated.find((r) => r.card.card_id === "travel-elite")!;
    expect(te.gate_failures.some((f) => f.code === "INCOME_FLOOR")).toBe(true);
  });

  it("uses the employment-specific income floor", () => {
    // dine-club: salaried 400k, self-employed 600k
    const at500k = { ...baseUser, annual_income_inr: 500000, fee_comfort_inr: 100000 };
    const asSalaried = recommend(catalog, { ...at500k, employment: "salaried" });
    const asSelfEmp = recommend(catalog, { ...at500k, employment: "self_employed" });
    expect(asSalaried.ranked.some((r) => r.card.card_id === "dine-club")).toBe(true);
    expect(asSelfEmp.gated.some((r) => r.card.card_id === "dine-club")).toBe(true);
  });

  it("blocks students from cards that exclude them", () => {
    const res = recommend(catalog, { ...baseUser, employment: "student", annual_income_inr: 0, fee_comfort_inr: 100000 });
    const rm = res.gated.find((r) => r.card.card_id === "rewards-multiplier")!;
    expect(rm.gate_failures.some((f) => f.code === "EMPLOYMENT_FIT")).toBe(true);
    // ...but the secured card still comes through
    expect(res.ranked.some((r) => r.card.card_id === "starter-secured")).toBe(true);
  });

  it("enforces min and max age", () => {
    const young = recommend(catalog, { ...baseUser, age: 19, fee_comfort_inr: 100000 });
    expect(young.gated.some((r) => r.card.card_id === "rewards-multiplier")).toBe(true);
    const old = recommend(catalog, { ...baseUser, age: 68, fee_comfort_inr: 100000 });
    expect(old.gated.some((r) => r.gate_failures.some((f) => f.code === "AGE_MAX"))).toBe(true);
  });

  it("hides discontinued cards entirely — not as a rejection", () => {
    const res = recommend(catalog, { ...baseUser, fee_comfort_inr: 100000 });
    expect(res.ranked.some((r) => r.card.card_id === "legacy-classic")).toBe(false);
    expect(res.gated.some((r) => r.card.card_id === "legacy-classic")).toBe(false);
  });

  it("every gated card carries a human-readable reason", () => {
    const res = recommend(catalog, baseUser);
    for (const g of res.gated) {
      expect(g.gate_failures.length).toBeGreaterThan(0);
      for (const f of g.gate_failures) expect(f.message.length).toBeGreaterThan(5);
    }
  });
});

/* ─────────────────────────── fit + ranking ─────────────────────────── */

describe("fit score", () => {
  it("weights the largest category 3x the third", () => {
    // dining 20k > online 12k > travel 5k
    const u: UserProfile = {
      ...baseUser,
      spend: [
        { category_id: "dining", monthly_inr: 20000 },
        { category_id: "online_shopping", monthly_inr: 12000 },
        { category_id: "travel_air", monthly_inr: 5000 },
      ],
    };
    // rewards-multiplier accelerates dining (w3) and online (w2) = 5/6
    const fit = computeFit(card("rewards-multiplier"), u, catalog.config, catalog.merchants);
    expect(fit.category_coverage).toBeCloseTo(5 / 6, 2);
    // travel-elite accelerates only travel_air (w1) = 1/6
    const fit2 = computeFit(card("travel-elite"), u, catalog.config, catalog.merchants);
    expect(fit2.category_coverage).toBeCloseTo(1 / 6, 2);
  });

  it("scores reward-type match", () => {
    const airmilesUser = { ...baseUser, preferred_channel: "airmiles" as const };
    expect(computeFit(card("rewards-multiplier"), airmilesUser, catalog.config, catalog.merchants).reward_type_match).toBe(1);
    expect(computeFit(card("everyday-cashback"), airmilesUser, catalog.config, catalog.merchants).reward_type_match).toBe(0);
  });

  it("does not penalise every card when no merchants are named", () => {
    const fit = computeFit(card("rewards-multiplier"), baseUser, catalog.config, catalog.merchants);
    expect(fit.merchant_overlap).toBe(0);
    // total must still be able to reach 1.0 without the merchant signal
    const perfect = computeFit(
      card("rewards-multiplier"),
      { ...baseUser, spend: [{ category_id: "dining", monthly_inr: 100 }] },
      catalog.config,
      catalog.merchants,
    );
    expect(perfect.total).toBeGreaterThan(0.9);
  });

  it("credits a co-brand merchant match", () => {
    const u = { ...baseUser, frequent_merchants: ["amazon"] };
    const fit = computeFit(card("axis-shop-plus"), u, catalog.config, catalog.merchants);
    expect(fit.matched_merchants).toContain("amazon");
  });
});

describe("ranking", () => {
  const cfg = { ...catalog.config, tiebreak_band_pct: 10 } as EngineConfig;
  const mk = (id: string, nav: number, fit: number): CardResult =>
    ({ card: { card_id: id } as Card, eligible: true, gate_failures: [],
       valuation: { nav_inr: nav } as never, fit: { total: fit } as never });

  it("sorts by NAV when outside the band", () => {
    const out = rankResults([mk("a", 100, 0), mk("b", 200, 1), mk("c", 50, 1)], cfg);
    expect(out.map((r) => r.card.card_id)).toEqual(["b", "a", "c"]);
  });

  it("reorders by fit inside the band", () => {
    // 1000 vs 950 → 5% apart, within the 10% band
    const out = rankResults([mk("high-nav", 1000, 0.2), mk("high-fit", 950, 0.9)], cfg);
    expect(out[0].card.card_id).toBe("high-fit");
    expect(out[0].tiebreak_applied).toBe(true);
  });

  it("does not reorder outside the band", () => {
    const out = rankResults([mk("a", 1000, 0.1), mk("b", 500, 0.99)], cfg);
    expect(out[0].card.card_id).toBe("a");
    expect(out[0].tiebreak_applied).toBe(false);
  });

  it("assigns every card exactly one rank, contiguously", () => {
    const out = rankResults([mk("a", 100, 0.5), mk("b", 98, 0.9), mk("c", 40, 0.1)], cfg);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("is deterministic across repeated runs", () => {
    const input = [mk("a", 100, 0.5), mk("b", 100, 0.5), mk("c", 100, 0.5)];
    const a = rankResults(input, cfg).map((r) => r.card.card_id);
    const b = rankResults(input, cfg).map((r) => r.card.card_id);
    expect(a).toEqual(b);
  });

  it("handles negative NAV without banding nonsense", () => {
    const out = rankResults([mk("a", -100, 0.1), mk("b", -50, 0.9)], cfg);
    expect(out.map((r) => r.card.card_id)).toEqual(["b", "a"]);
  });
});

/* ─────────────────────────── end to end ────────────────────────────── */

describe("recommend()", () => {
  it("returns a ranked list and gated list that partition the catalog", () => {
    const res = recommend(catalog, baseUser);
    const active = catalog.cards.filter((c) => c.status === "active").length;
    expect(res.ranked.length + res.gated.length).toBe(active);
  });

  it("changing only the redemption preference can flip the ranking", () => {
    const asVoucher = recommend(catalog, { ...baseUser, preferred_channel: "voucher", fee_comfort_inr: 3000 });
    const asAirmiles = recommend(catalog, { ...baseUser, preferred_channel: "airmiles", fee_comfort_inr: 3000 });
    expect(asVoucher.ranked[0].card.card_id).not.toBe(asAirmiles.ranked[0].card.card_id);
  });

  it("warns when the residual bucket outweighs every named category", () => {
    const res = recommend(catalog, { ...baseUser, residual_monthly_inr: 90000 });
    expect(res.warnings.some((w) => w.includes("everything else"))).toBe(true);
  });

  it("produces an explanation for every ranked card", () => {
    const res = recommend(catalog, baseUser);
    for (const r of res.ranked) {
      expect(r.explanation!.length).toBeGreaterThan(0);
    }
  });

  it("NAV always equals gross minus fee minus forex", () => {
    const res = recommend(catalog, { ...baseUser, fee_comfort_inr: 100000, annual_income_inr: 5000000 });
    for (const r of res.ranked) {
      const v = r.valuation!;
      expect(v.nav_inr).toBeCloseTo(v.gross_annual_inr - v.effective_fee_inr - v.forex_cost_inr, 2);
    }
  });

  it("gross always equals annual rewards plus milestones", () => {
    const res = recommend(catalog, { ...baseUser, fee_comfort_inr: 100000, annual_income_inr: 5000000 });
    for (const r of res.ranked) {
      const v = r.valuation!;
      expect(v.gross_annual_inr).toBeCloseTo(v.annual_rewards_inr + v.milestone_value_inr, 2);
    }
  });

  it("survives an empty spend profile without throwing", () => {
    const res = recommend(catalog, { ...baseUser, spend: [], residual_monthly_inr: 0 });
    expect(res.ranked.length).toBeGreaterThan(0);
    expect(res.warnings.some((w) => w.includes("No spend"))).toBe(true);
  });

  it("returns a helpful warning when everything is gated", () => {
    const res = recommend(catalog, {
      ...baseUser,
      age: 17,
      annual_income_inr: 0,
      fee_comfort_inr: 0,
    });
    expect(res.ranked).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes("No card"))).toBe(true);
  });

  it("is deterministic — same input, same output", () => {
    const a = recommend(catalog, baseUser);
    const b = recommend(catalog, baseUser);
    expect(a.ranked.map((r) => r.card.card_id)).toEqual(b.ranked.map((r) => r.card.card_id));
    expect(a.ranked.map((r) => r.valuation!.nav_inr)).toEqual(
      b.ranked.map((r) => r.valuation!.nav_inr),
    );
  });
});
