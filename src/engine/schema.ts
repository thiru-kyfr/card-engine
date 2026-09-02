/**
 * Runtime validation for everything that enters the engine.
 *
 * The catalog is written by humans in YAML, so it is validated as untrusted
 * input: a malformed card fails loudly at boot rather than silently scoring
 * wrong at request time.
 */
import { z } from "zod";

export const employmentSchema = z.enum(["salaried", "self_employed", "student"]);
export const channelSchema = z.enum([
  "cashback",
  "voucher",
  "portal",
  "airmiles",
  "merchandise",
]);

export const categorySchema = z.object({
  category_id: z.string().regex(/^[a-z0-9_]+$/, "category_id must be lowercase snake_case"),
  display_name: z.string().min(1),
  parent_category: z.enum(["essential", "discretionary", "other"]).optional(),
  mcc_codes: z.array(z.string()).optional(),
  mapping_confidence: z.enum(["high", "medium", "low"]).default("medium"),
  is_selectable_in_form: z.boolean().default(true),
  form_display_order: z.number().int().optional(),
  commonly_excluded: z.boolean().optional(),
  notes: z.string().optional(),
});

export const merchantSchema = z.object({
  merchant_id: z.string().regex(/^[a-z0-9_]+$/),
  display_name: z.string().min(1),
  category_id: z.string(),
  aliases: z.array(z.string()).optional(),
  has_cobrand_card: z.boolean().default(false),
  cobrand_card_id: z.string().optional(),
  show_in_picker: z.boolean().default(true),
  notes: z.string().optional(),
});

export const acceleratorSchema = z.object({
  id: z.string().min(1),
  scope: z.object({
    type: z.enum(["category", "merchant_list", "portal"]),
    value: z.string().min(1),
  }),
  multiplier: z.number().positive(),
  basis: z.enum(["total", "additional"]).default("total"),
  cap: z.object({
    type: z.enum(["spend", "points", "none"]),
    value: z.number().positive().optional(),
    window: z
      .enum(["statement_cycle", "calendar_month", "quarter", "year"])
      .default("statement_cycle"),
  }),
  post_cap: z.number().min(0).max(1),
  valid_from: z.string().optional(),
  valid_to: z.string().optional(),
  priority: z.number().int().default(3),
  notes: z.string().optional(),
}).refine(
  (a) => a.cap.type === "none" || typeof a.cap.value === "number",
  { message: "cap.value is required unless cap.type is 'none'" },
);

export const redemptionSchema = z.object({
  channel: channelSchema,
  inr_per_point: z.number().positive(),
  min_points: z.number().int().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  transfer_ratio: z.string().optional(),
  partners: z.array(z.string()).optional(),
  is_default: z.boolean().default(false),
});

export const milestoneSchema = z.object({
  id: z.string().min(1),
  threshold: z.number().positive(),
  reward_type: z.enum(["points", "voucher", "waiver", "free_night"]),
  value_inr: z.number().nonnegative(),
  window: z.enum(["annual", "quarterly", "anniversary"]).default("annual"),
  cumulative: z.boolean().default(true),
  notes: z.string().optional(),
});

export const exclusionSchema = z.object({
  category: z.string().min(1),
  treatment: z.enum(["zero_earn", "base_only"]).default("zero_earn"),
  notes: z.string().optional(),
});

export const cardSchema = z
  .object({
    card_id: z.string().regex(/^[a-z0-9-]+$/, "card_id must be a lowercase slug"),
    name: z.string().min(1),
    issuer: z.string().min(1),
    network: z.object({ name: z.string().min(1), tier: z.string().optional() }),
    tier: z.enum(["entry", "mid", "premium", "super_premium"]),
    status: z.enum(["active", "discontinued", "draft"]).default("active"),
    gates: z.object({
      min_age: z.number().int().min(0).max(100),
      max_age: z.number().int().min(0).max(120).optional(),
      allowed_employment: z.array(employmentSchema).min(1),
      min_income: z.record(employmentSchema, z.number().nonnegative()),
    }),
    base: z.object({
      points_per_unit: z.number().positive(),
      unit_inr: z.number().positive(),
      currency: z.enum(["points", "cashback", "miles"]).default("points"),
    }),
    fee: z.object({
      annual: z.number().nonnegative(),
      joining: z.number().nonnegative().optional(),
      waiver_threshold: z.number().positive().optional(),
      gst_pct: z.number().min(0).max(100).default(18),
    }),
    forex_markup_pct: z.number().min(0).max(20).default(3.5),
    welcome: z
      .object({ points: z.number().nonnegative().optional(), condition: z.string().optional() })
      .optional(),
    points_expiry_months: z.number().int().positive().optional(),
    accelerators: z.array(acceleratorSchema).default([]),
    redemption: z.array(redemptionSchema).min(1, "a card needs at least one redemption channel"),
    milestones: z.array(milestoneSchema).default([]),
    exclusions: z.array(exclusionSchema).default([]),
    meta: z.object({
      terms_url: z.string().optional(),
      effective_date: z.string().optional(),
      last_verified: z.string().optional(),
      owner: z.string().optional(),
      confidence: z.enum(["high", "medium", "low"]).default("medium"),
    }),
    notes: z.string().optional(),
  })
  .superRefine((card, ctx) => {
    const defaults = card.redemption.filter((r) => r.is_default);
    if (defaults.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `exactly one redemption channel must be is_default (found ${defaults.length})`,
        path: ["redemption"],
      });
    }
    const channels = card.redemption.map((r) => r.channel);
    if (new Set(channels).size !== channels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate redemption channel",
        path: ["redemption"],
      });
    }
    const ids = card.accelerators.map((a) => a.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "duplicate accelerator id",
        path: ["accelerators"],
      });
    }
    for (const e of card.gates.allowed_employment) {
      if (card.gates.min_income[e] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `min_income missing for allowed employment type '${e}'`,
          path: ["gates", "min_income"],
        });
      }
    }
  });

export const engineConfigSchema = z.object({
  gst_pct: z.number().min(0).max(100).default(18),
  tiebreak_band_pct: z.number().min(0).max(100).default(10),
  rank_weight_1: z.number().nonnegative().default(3),
  rank_weight_2: z.number().nonnegative().default(2),
  rank_weight_3: z.number().nonnegative().default(1),
  fit_weight_category_coverage: z.number().min(0).max(1).default(0.6),
  fit_weight_reward_type_match: z.number().min(0).max(1).default(0.25),
  fit_weight_merchant_overlap: z.number().min(0).max(1).default(0.15),
  // "persona_split" was considered (see README) but never implemented — valuation.ts
  // always treats the residual as base_rate. Only accepting the real value here
  // means a stray config edit fails loudly at boot instead of being silently ignored.
  residual_treatment: z.literal("base_rate").default("base_rate"),
  welcome_bonus_in_nav: z.boolean().default(false),
  benefits_in_nav: z.boolean().default(false),
  redemption_friction_enabled: z.boolean().default(false),
  redemption_friction: z
    .record(channelSchema, z.number().min(0).max(1))
    .default({ cashback: 1, voucher: 0.9, portal: 0.85, airmiles: 0.7, merchandise: 0.9 }),
  fee_gate_mode: z.enum(["hard_sticker", "waiver_aware"]).default("hard_sticker"),
  credit_score_enabled: z.boolean().default(false),
  min_categories_collected: z.number().int().min(1).max(10).default(3),
  catalog_staleness_alert_days: z.number().int().positive().default(90),
});

/* ── Request payload ────────────────────────────────────────────────── */

export const userProfileSchema = z.object({
  age: z.number().int().min(16).max(100),
  employment: employmentSchema,
  annual_income_inr: z.number().nonnegative().max(1_000_000_000),
  spend: z
    .array(
      z.object({
        category_id: z.string().min(1),
        monthly_inr: z.number().nonnegative().max(10_000_000),
      }),
    )
    .max(10),
  residual_monthly_inr: z.number().nonnegative().max(10_000_000),
  preferred_channel: channelSchema,
  fee_comfort_inr: z.number().nonnegative().max(1_000_000),
  frequent_merchants: z.array(z.string()).max(30).default([]),
});

export type ParsedCard = z.infer<typeof cardSchema>;
export type ParsedConfig = z.infer<typeof engineConfigSchema>;
