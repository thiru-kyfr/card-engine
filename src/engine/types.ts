/**
 * Domain types for the Card Determination Engine.
 *
 * Scope (v1): recommends a card to someone who does NOT yet hold it.
 * That assumption removes cap-consumption state, statement dates and live balances.
 */

export type EmploymentType = "salaried" | "self_employed" | "student";
export type RedemptionChannel =
  | "cashback"
  | "voucher"
  | "portal"
  | "airmiles"
  | "merchandise";
export type ScopeType = "category" | "merchant_list" | "portal";
export type MultiplierBasis = "total" | "additional";
export type CapType = "spend" | "points" | "none";
export type CapWindow = "statement_cycle" | "calendar_month" | "quarter" | "year";
export type ExclusionTreatment = "zero_earn" | "base_only";
export type CardTier = "entry" | "mid" | "premium" | "super_premium";
export type CardStatus = "active" | "discontinued" | "draft";
export type Confidence = "high" | "medium" | "low";
export type MilestoneRewardType = "points" | "voucher" | "waiver" | "free_night";

/* ── Catalog: shared reference data ─────────────────────────────────── */

export interface Category {
  category_id: string;
  display_name: string;
  parent_category?: "essential" | "discretionary" | "other";
  mcc_codes?: string[];
  mapping_confidence: Confidence;
  is_selectable_in_form: boolean;
  form_display_order?: number;
  commonly_excluded?: boolean;
  notes?: string;
}

export interface Merchant {
  merchant_id: string;
  display_name: string;
  category_id: string;
  aliases?: string[];
  has_cobrand_card: boolean;
  cobrand_card_id?: string;
  show_in_picker: boolean;
  notes?: string;
}

/* ── Catalog: per-card configuration ────────────────────────────────── */

export interface Accelerator {
  id: string;
  scope: { type: ScopeType; value: string };
  multiplier: number;
  /** `total`: 5X means 5x base overall. `additional`: 5X is added on top, so 6x total. */
  basis: MultiplierBasis;
  cap: { type: CapType; value?: number; window: CapWindow };
  /** 1 = reverts to base rate past the cap. 0 = earns nothing past the cap. */
  post_cap: number;
  valid_from?: string;
  valid_to?: string;
  /** Lower wins when two rules match the same spend. */
  priority: number;
  notes?: string;
}

export interface RedemptionOption {
  channel: RedemptionChannel;
  inr_per_point: number;
  min_points?: number;
  fee?: number;
  transfer_ratio?: string;
  partners?: string[];
  is_default: boolean;
}

export interface Milestone {
  id: string;
  threshold: number;
  reward_type: MilestoneRewardType;
  value_inr: number;
  window: "annual" | "quarterly" | "anniversary";
  cumulative: boolean;
  notes?: string;
}

export interface Exclusion {
  category: string;
  treatment: ExclusionTreatment;
  notes?: string;
}

export interface Card {
  card_id: string;
  name: string;
  issuer: string;
  network: { name: string; tier?: string };
  tier: CardTier;
  status: CardStatus;
  gates: {
    min_age: number;
    max_age?: number;
    allowed_employment: EmploymentType[];
    min_income: Partial<Record<EmploymentType, number>>;
  };
  base: { points_per_unit: number; unit_inr: number; currency: "points" | "cashback" | "miles" };
  fee: {
    annual: number;
    joining?: number;
    /** Undefined = no waiver exists. A number = fee is zero at that annual spend. */
    waiver_threshold?: number;
    gst_pct: number;
  };
  forex_markup_pct: number;
  welcome?: { points?: number; condition?: string };
  points_expiry_months?: number;
  accelerators: Accelerator[];
  redemption: RedemptionOption[];
  milestones: Milestone[];
  exclusions: Exclusion[];
  meta: {
    terms_url?: string;
    effective_date?: string;
    last_verified?: string;
    owner?: string;
    confidence: Confidence;
  };
  notes?: string;
}

export interface EngineConfig {
  gst_pct: number;
  tiebreak_band_pct: number;
  rank_weight_1: number;
  rank_weight_2: number;
  rank_weight_3: number;
  fit_weight_category_coverage: number;
  fit_weight_reward_type_match: number;
  fit_weight_merchant_overlap: number;
  residual_treatment: "base_rate";
  welcome_bonus_in_nav: boolean;
  benefits_in_nav: boolean;
  redemption_friction_enabled: boolean;
  /** Realization factors, applied only when redemption_friction_enabled is true. */
  redemption_friction: Partial<Record<RedemptionChannel, number>>;
  fee_gate_mode: "hard_sticker" | "waiver_aware";
  credit_score_enabled: boolean;
  min_categories_collected: number;
  catalog_staleness_alert_days: number;
}

export interface Catalog {
  cards: Card[];
  categories: Category[];
  merchants: Merchant[];
  config: EngineConfig;
}

/* ── Engine input ───────────────────────────────────────────────────── */

export interface SpendLine {
  category_id: string;
  monthly_inr: number;
}

export interface UserProfile {
  age: number;
  employment: EmploymentType;
  annual_income_inr: number;
  /** The user's named categories. Order is irrelevant — they are ranked by amount. */
  spend: SpendLine[];
  /** The mandatory "everything else" bucket. Always earns base rate in v1. */
  residual_monthly_inr: number;
  preferred_channel: RedemptionChannel;
  fee_comfort_inr: number;
  frequent_merchants: string[];
}

/* ── Engine output ──────────────────────────────────────────────────── */

export type GateCode =
  | "STATUS"
  | "AGE_MIN"
  | "AGE_MAX"
  | "EMPLOYMENT_FIT"
  | "INCOME_FLOOR"
  | "FEE_COMFORT";

export interface GateFailure {
  code: GateCode;
  message: string;
}

export interface CategoryBreakdown {
  category_id: string;
  display_name: string;
  monthly_spend: number;
  /** Which accelerator applied, if any. */
  rule_id?: string;
  effective_multiplier: number;
  /** Spend that qualified for the bonus rate. */
  eligible_spend: number;
  /** Spend that spilled past the cap. */
  overflow_spend: number;
  cap_hit: boolean;
  cap_label?: string;
  excluded?: ExclusionTreatment;
  monthly_points: number;
}

export interface MilestoneHit {
  id: string;
  threshold: number;
  value_inr: number;
  notes?: string;
}

export interface Valuation {
  /** L1 */
  categories: CategoryBreakdown[];
  monthly_points: number;
  /** L2 */
  channel: RedemptionChannel;
  channel_was_fallback: boolean;
  inr_per_point: number;
  friction_factor: number;
  monthly_value_inr: number;
  /** L3 */
  annual_rewards_inr: number;
  milestones_hit: MilestoneHit[];
  milestone_value_inr: number;
  gross_annual_inr: number;
  /** L4 */
  annual_spend_inr: number;
  fee_waived: boolean;
  effective_fee_inr: number;
  forex_cost_inr: number;
  nav_inr: number;
  /** Reported separately — never inside NAV. */
  welcome_bonus_inr: number;
}

export interface FitScore {
  category_coverage: number;
  reward_type_match: number;
  merchant_overlap: number;
  total: number;
  /** Which of the user's ranked categories this card accelerates. */
  covered_categories: string[];
  matched_merchants: string[];
}

export interface CardResult {
  card: Card;
  eligible: boolean;
  gate_failures: GateFailure[];
  valuation?: Valuation;
  fit?: FitScore;
  /** Populated after ranking. 1-indexed. Undefined for gated cards. */
  rank?: number;
  /** True when the tiebreak band moved this card ahead of a higher-NAV card. */
  tiebreak_applied?: boolean;
  explanation?: string[];
}

export interface RecommendationResult {
  ranked: CardResult[];
  gated: CardResult[];
  warnings: string[];
  meta: {
    total_monthly_spend: number;
    total_annual_spend: number;
    cards_evaluated: number;
    tiebreak_band_pct: number;
    generated_at: string;
  };
}
