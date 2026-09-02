/**
 * Transforms the cached mtuzo.net benefits responses (scripts/.mtuzo-cache/)
 * into catalog/cards/*.yaml. Run fetch-mtuzo-benefits.ts first.
 *
 * Per the user's decision: only cards where mtuzo actually has benefits data
 * are included. A card whose every network-code variant comes back with an
 * empty cardvalue is dropped rather than kept with stale/fabricated numbers.
 *
 * Key structural translation, since the two schemas model earning
 * differently:
 *  - mtuzo lists every accrual rule (including the card's own baseline) as
 *    flat entries with a category/brand and a points-per-rupee rate. The
 *    engine instead wants ONE base rate plus accelerators expressed as a
 *    MULTIPLE of that base. So: the lowest-rate, brand-less, generic-
 *    category entry becomes `base`; every other entry becomes an
 *    accelerator with multiplier = its rate / base rate.
 *  - the engine only ever matches accelerators by category_id (see
 *    valuation.ts findAccelerator) — merchant/portal-scoped rules are never
 *    read by the NAV math. So brand-specific rules (e.g. "5x at Myntra")
 *    are folded into their category (apparel), keeping the highest rate
 *    per category rather than emitting one rule per brand.
 *  - mtuzo doesn't expose forex markup or reward-earning exclusions at all;
 *    those fields fall back to the schema's own defaults and say so in
 *    `notes`, rather than inventing a number.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stringify as toYaml } from "yaml";

const CACHE_DIR = path.join(__dirname, ".mtuzo-cache");
const CARDS_DIR = path.join(__dirname, "..", "catalog", "cards");

/* ── small parsing helpers ─────────────────────────────────────────── */

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cardIdFor(cardName: string): string {
  const stripped = cardName.replace(/\bcredit card\b/gi, "").trim();
  return slugify(stripped || cardName);
}

const ISSUER_NAME: Record<string, string> = {
  "au bank": "AU Small Finance Bank",
  amex: "American Express",
  "axis bank": "Axis Bank",
  bob: "BOBCARD",
  csb: "CSB Bank",
  federal: "Federal Bank",
  "hdfc bank": "HDFC Bank",
  hsbc: "HSBC Bank",
  "icici bank": "ICICI Bank",
  idfc: "IDFC FIRST Bank",
  indusind: "IndusInd Bank",
  kotak: "Kotak Mahindra Bank",
  "one card": "OneCard / FPL Technologies",
  rbl: "RBL Bank",
  "sbi cards": "SBI Card",
  sbm: "SBM Bank India",
  stanc: "Standard Chartered Bank",
  "yes bank": "YES Bank",
};

/* ── category taxonomy mapping ─────────────────────────────────────── */

/** mtuzo's featured_category string -> our category_id(s). Empty array = a
 *  generic/base-rate signal, not a real accelerator category. */
const CATEGORY_MAP: Record<string, string[]> = {
  "apparel and departmental stores": ["apparel", "departmental"],
  "car rentals": ["cabs_transit"],
  currency: ["international"],
  "departmental stores": ["departmental"],
  "departmental stores.": ["departmental"],
  dining: ["dining"],
  "domestic and international spends": [],
  "earn reward points spend on utilities and insurance": ["utilities", "insurance"],
  education: ["education"],
  electronics: ["electronics"],
  entertainment: ["entertainment"],
  flights: ["travel_air"],
  fuel: ["fuel"],
  grocery: ["groceries"],
  hotels: ["travel_hotel"],
  insurance: ["insurance"],
  "insurance and utility": ["insurance", "utilities"],
  "insurance and utility ": ["insurance", "utilities"],
  "international purchases": ["international"],
  "international spends": ["international"],
  jewellery: ["jewellery"],
  mobile: ["telecom"],
  movies: ["entertainment"],
  online: ["online_shopping"],
  rental: ["rent"],
  retail: [],
  services: ["other"],
  shopping: ["online_shopping"],
  sports: ["entertainment"],
  telecom: ["telecom"],
  travel: ["travel_air"],
  utilities: ["utilities"],
  utility: ["utilities"],
  "utility bill": ["utilities"],
  vouchers: [],
  watches: ["other"],
  wellness: ["healthcare"],
  "": [],
};

/** Brand -> category, used when an entry names a merchant instead of (or in
 *  addition to) a featured_category — our engine has no merchant-level
 *  spend input, so every brand rule folds into its category. */
const BRAND_CATEGORY: Record<string, string> = {
  amazon: "online_shopping",
  flipkart: "online_shopping",
  ajio: "apparel",
  myntra: "apparel",
  nykaa: "apparel",
  "nykaa fashion": "apparel",
  uniqlo: "apparel",
  westside: "apparel",
  "shoppers stop": "departmental",
  farfetch: "apparel",
  jockey: "apparel",
  koskii: "apparel",
  "marks & spencer": "apparel",
  puma: "apparel",
  mokobara: "apparel",
  swiggy: "dining",
  zomato: "dining",
  dominos: "dining",
  qmin: "dining",
  bigbasket: "groceries",
  blinkit: "groceries",
  "reliance smart superstore": "groceries",
  uber: "cabs_transit",
  olacabs: "cabs_transit",
  "air india": "travel_air",
  "air india express": "travel_air",
  indigo: "travel_air",
  makemytrip: "travel_air",
  easemytrip: "travel_air",
  cleartrip: "travel_air",
  yatra: "travel_air",
  irctc: "travel_air",
  "marriott bonvoy": "travel_hotel",
  ihcl: "travel_hotel",
  croma: "electronics",
  "reliance digital": "electronics",
  acer: "electronics",
  apple: "electronics",
  boat: "electronics",
  dyson: "electronics",
  lenovo: "electronics",
  "tata cliq": "electronics",
  "pvr cinemas": "entertainment",
  bookmyshow: "entertainment",
  cult: "entertainment",
  "tata play": "entertainment",
  lic: "insurance",
  apollo247: "healthcare",
  pharmeasy: "healthcare",
  "tata 1mg": "healthcare",
  tata1mg: "healthcare",
  netmeds: "healthcare",
  "urban company": "healthcare",
  "forest essentials": "healthcare",
  "wellbeing nutrition": "healthcare",
  titan: "jewellery",
  tanishq: "jewellery",
  "tata neu": "online_shopping",
  payzapp: "wallet_load",
  gyftr: "other",
  "igp.com": "other",
  smartbuy: "other",
  bpcl: "fuel",
  iocl: "fuel",
};

function resolveCategories(featuredCategory: string, brand: string): string[] {
  const fc = (featuredCategory || "").trim().toLowerCase();
  const mapped = CATEGORY_MAP[fc];
  if (mapped && mapped.length > 0) return mapped;
  const b = (brand || "").trim().toLowerCase();
  if (b && BRAND_CATEGORY[b]) return [BRAND_CATEGORY[b]];
  return mapped ?? []; // known-generic (e.g. "retail") or unrecognized -> []
}

/* ── mtuzo response typing (loose — this is untrusted external JSON) ── */

interface Criteria {
  [k: string]: unknown;
}
interface AccrualEntry {
  minimum_spend?: string;
  earned_points?: string;
  criteria?: Criteria & { featured_category?: string; brand?: string; maximum_capping?: string; capping_valid_span?: string };
}
interface RedemptionEntry {
  offer_type?: string;
  conversion_rate?: string;
  conversion_type?: string;
  reward_points?: string;
}
interface EligibilityEntry {
  minimum_age?: string;
  maximum_age?: string;
  min_income?: string;
  income_tenure?: string;
}
interface FeeEntry {
  offer_type?: string;
  fee_amount?: string;
  minimum_spend?: string;
}
interface MilestoneEntry {
  summary?: string;
  offer_type?: string;
  voucher_amount?: string;
  criteria?: { minimum_spend?: string; min_spend_valid_span?: string };
}
interface MembershipEntry {
  summary?: string;
  brand?: string;
}

interface CardValue {
  reward_points?: { accural?: AccrualEntry[]; reward_redemption?: RedemptionEntry[] };
  eligibility?: Record<string, EligibilityEntry[]>;
  fees?: { issuing_fees?: FeeEntry[]; fee_waiver?: FeeEntry[] };
  milestone_benefits?: { annual_milestone?: MilestoneEntry[]; quaterly_milestone?: MilestoneEntry[] };
  welcome_benefits?: { membership?: MembershipEntry[] };
}

interface CachedResponse {
  response: { bankname: string; cardname: string; network: string; cardvalue: CardValue | [] };
  _source_row: { bank: string; card: string; network: string; code: string };
}

/* ── pick the best-populated variant per unique card ───────────────── */

function score(cv: CardValue | []): number {
  if (Array.isArray(cv)) return 0;
  const hasAccrual = !!cv.reward_points?.accural?.length;
  return Object.keys(cv).length + (hasAccrual ? 100 : 0);
}

function loadBestVariants(): CachedResponse[] {
  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json") && f !== "_failures.json");
  const byCard = new Map<string, CachedResponse[]>();
  for (const f of files) {
    const d = JSON.parse(readFileSync(path.join(CACHE_DIR, f), "utf8")) as CachedResponse;
    const key = `${d._source_row.bank}::${d._source_row.card}`.toLowerCase();
    if (!byCard.has(key)) byCard.set(key, []);
    byCard.get(key)!.push(d);
  }
  const best: CachedResponse[] = [];
  for (const variants of byCard.values()) {
    const top = [...variants].sort((a, b) => score(b.response.cardvalue) - score(a.response.cardvalue))[0];
    if (score(top.response.cardvalue) > 0) best.push(top);
  }
  return best;
}

/* ── per-card transform ─────────────────────────────────────────────── */

function windowFor(span: string | undefined): "statement_cycle" | "calendar_month" | "quarter" | "year" {
  const s = (span || "").toLowerCase();
  if (s.includes("quarter")) return "quarter";
  if (s.includes("month")) return "calendar_month";
  if (s.includes("year") || s.includes("annual")) return "year";
  if (s.includes("statement")) return "statement_cycle";
  return "statement_cycle";
}

function tierFor(annualFee: number): "entry" | "mid" | "premium" | "super_premium" {
  if (annualFee <= 1000) return "entry";
  if (annualFee <= 5000) return "mid";
  if (annualFee <= 15000) return "premium";
  return "super_premium";
}

function buildCard(entry: CachedResponse, usedIds: Set<string>) {
  const row = entry._source_row;
  const cv = entry.response.cardvalue as CardValue;
  const issuer = ISSUER_NAME[row.bank.toLowerCase()] ?? row.bank;
  const name = row.card.trim();
  const notes: string[] = [
    `SOURCE: mtuzo.net Benefits API v7 (cardcode ${row.code}, ${row.network} variant), fetched fresh — not the earlier hand-curated import.`,
  ];

  let cardId = cardIdFor(name);
  if (usedIds.has(cardId)) cardId = slugify(`${issuer}-${name}`);
  usedIds.add(cardId);

  /* — accrual: split into base rate + category accelerators — */
  const accural = cv.reward_points?.accural ?? [];
  type Rated = { rate: number; entry: AccrualEntry; categories: string[]; isGeneric: boolean };
  const rated: Rated[] = [];
  for (const a of accural) {
    const min = num(a.minimum_spend);
    const pts = num(a.earned_points);
    if (!min || !pts) continue;
    const categories = resolveCategories(a.criteria?.featured_category ?? "", a.criteria?.brand ?? "");
    rated.push({ rate: pts / min, entry: a, categories, isGeneric: categories.length === 0 });
  }

  let basePointsPerUnit = 1;
  let baseUnitInr = 100;
  let baseEntry: Rated | undefined;
  const genericCandidates = rated.filter((r) => r.isGeneric);
  if (genericCandidates.length > 0) {
    baseEntry = genericCandidates.sort((a, b) => a.rate - b.rate)[0];
  } else if (rated.length > 0) {
    baseEntry = [...rated].sort((a, b) => a.rate - b.rate)[0];
  }
  if (baseEntry) {
    basePointsPerUnit = num(baseEntry.entry.earned_points) ?? 1;
    baseUnitInr = num(baseEntry.entry.minimum_spend) ?? 100;
  } else {
    notes.push("No usable accrual entries from the API — base rate defaulted to 1 point per Rs.100.");
  }
  const baseRate = basePointsPerUnit / baseUnitInr;

  // group non-base entries by resolved category, keep the best rate per category
  const byCategory = new Map<string, Rated>();
  for (const r of rated) {
    if (r === baseEntry) continue;
    for (const catId of r.categories) {
      const existing = byCategory.get(catId);
      if (!existing || r.rate > existing.rate) byCategory.set(catId, r);
    }
  }

  const accelerators = [...byCategory.entries()]
    .filter(([, r]) => r.rate > baseRate)
    .map(([catId, r], i) => {
      const cap = num(r.entry.criteria?.maximum_capping);
      return {
        id: `${cardId}-${catId}-${i}`.slice(0, 60),
        scope: { type: "category" as const, value: catId },
        multiplier: Math.round((r.rate / baseRate) * 100) / 100,
        basis: "total" as const,
        cap: cap
          ? { type: "points" as const, value: cap, window: windowFor(r.entry.criteria?.capping_valid_span) }
          : { type: "none" as const, window: "statement_cycle" as const },
        post_cap: 1,
        priority: 3,
        notes: r.entry.criteria?.brand
          ? `mtuzo entry named brand "${r.entry.criteria.brand}"; applied to the whole ${catId} category since the engine has no per-merchant spend input.`
          : undefined,
      };
    });

  /* — redemption channels — */
  const redemptions = cv.reward_points?.reward_redemption ?? [];
  const byChannel = new Map<string, { channel: "cashback" | "voucher" | "portal" | "airmiles" | "merchandise"; rate: number }>();
  for (const r of redemptions) {
    if ((r.conversion_type ?? "").trim().toLowerCase() !== "rs") continue; // can't monetize airmiles etc. without guessing
    const totalValue = num(r.conversion_rate);
    if (!totalValue) continue;
    // conversion_rate is sometimes a per-1-point rate (reward_points: "1")
    // and sometimes the total value of a fixed-cost redemption (e.g.
    // "24000 points for a Rs.14000 voucher") — always divide by the points
    // cost to get a true per-point rate.
    const pointsCost = num(r.reward_points) ?? 1;
    const rate = totalValue / pointsCost;
    if (!rate || !Number.isFinite(rate)) continue;
    const t = (r.offer_type ?? "").toLowerCase();
    let channel: "cashback" | "voucher" | "portal" | "airmiles" | "merchandise" = "voucher";
    if (t.includes("cashback")) channel = "cashback";
    else if (t.includes("catalogue") || t.includes("catalog") || t.includes("travel")) channel = "portal";
    else if (t.includes("voucher")) channel = "voucher";
    const existing = byChannel.get(channel);
    if (!existing || rate > existing.rate) byChannel.set(channel, { channel, rate });
  }
  let redemption = [...byChannel.values()].map((c) => ({
    channel: c.channel,
    inr_per_point: c.rate,
    is_default: false,
  }));
  if (redemption.length === 0) {
    redemption = [{ channel: "voucher", inr_per_point: 0.25, is_default: true }];
    notes.push("No Rs-denominated redemption rate in the API response — defaulted to a conservative Rs.0.25/point voucher rate.");
  } else {
    const best = [...redemption].sort((a, b) => b.inr_per_point - a.inr_per_point)[0];
    best.is_default = true;
  }

  /* — eligibility gates — */
  const elig = cv.eligibility ?? {};
  const employmentTypes = (Object.keys(elig) as string[]).filter(
    (k): k is "salaried" | "self_employed" => k === "salaried" || k === "self_employed",
  );
  let minAge = 18;
  let maxAge: number | undefined;
  const minIncome: Record<string, number> = {};
  for (const emp of employmentTypes) {
    const rows = elig[emp] ?? [];
    for (const r of rows) {
      const a1 = num(r.minimum_age);
      const a2 = num(r.maximum_age);
      if (a1 !== undefined) minAge = Math.max(minAge, a1);
      if (a2 !== undefined) maxAge = maxAge === undefined ? a2 : Math.max(maxAge, a2);
      const inc = num(r.min_income) ?? 0;
      const annualInc = (r.income_tenure ?? "").toLowerCase().includes("month") ? inc * 12 : inc;
      minIncome[emp] = Math.max(minIncome[emp] ?? 0, annualInc);
    }
  }
  if (employmentTypes.length === 0) {
    employmentTypes.push("salaried");
    minIncome.salaried = 0;
    notes.push("No eligibility block in the API response — defaulted to salaried, no stated income floor.");
  }

  /* — fees — */
  const issuing = cv.fees?.issuing_fees ?? [];
  const waivers = cv.fees?.fee_waiver ?? [];
  const findFee = (kw: string) => issuing.find((f) => (f.offer_type ?? "").toLowerCase().includes(kw));
  const joiningFee = findFee("joining");
  const renewalFee = findFee("renewal") ?? findFee("annual");
  const joining = num(joiningFee?.fee_amount) ?? num(renewalFee?.fee_amount) ?? 0;
  const annual = num(renewalFee?.fee_amount) ?? num(joiningFee?.fee_amount) ?? 0;
  const waiver = waivers.find((w) => /renewal|annual/.test((w.offer_type ?? "").toLowerCase()));
  const waiverThreshold = num(waiver?.minimum_spend);

  /* — milestones — */
  const milestones: { id: string; threshold: number; reward_type: "points" | "voucher" | "waiver" | "free_night"; value_inr: number; window: "annual" | "quarterly" | "anniversary"; cumulative: boolean }[] = [];
  const pushMilestones = (list: MilestoneEntry[] | undefined, win: "annual" | "quarterly") => {
    (list ?? []).forEach((m, i) => {
      const threshold = num(m.criteria?.minimum_spend);
      if (!threshold) return;
      const value = num(m.voucher_amount) ?? 0;
      const text = `${m.offer_type ?? ""} ${m.summary ?? ""}`.toLowerCase();
      const rewardType: "points" | "voucher" | "waiver" | "free_night" = text.includes("waiver")
        ? "waiver"
        : text.includes("night")
          ? "free_night"
          : text.includes("point")
            ? "points"
            : "voucher";
      milestones.push({
        id: `${cardId}-milestone-${win}-${i}`.slice(0, 60),
        threshold,
        reward_type: rewardType,
        value_inr: value,
        window: win,
        cumulative: true,
      });
    });
  };
  pushMilestones(cv.milestone_benefits?.annual_milestone, "annual");
  pushMilestones(cv.milestone_benefits?.quaterly_milestone, "quarterly");

  /* — welcome — */
  const memberships = cv.welcome_benefits?.membership ?? [];
  const welcomeCondition =
    memberships.length > 0
      ? `Complimentary memberships on qualifying spend: ${memberships.map((m) => m.brand || m.summary).filter(Boolean).join(", ")}.`
      : undefined;

  const tier = tierFor(annual);

  const card = {
    card_id: cardId,
    name,
    issuer,
    network: { name: entry.response.network || "unspecified" },
    tier,
    status: "active" as const,
    gates: {
      min_age: minAge,
      ...(maxAge !== undefined ? { max_age: maxAge } : {}),
      allowed_employment: employmentTypes,
      min_income: Object.fromEntries(employmentTypes.map((e) => [e, minIncome[e] ?? 0])),
    },
    base: { points_per_unit: basePointsPerUnit, unit_inr: baseUnitInr, currency: "points" as const },
    fee: {
      annual,
      joining,
      ...(waiverThreshold ? { waiver_threshold: waiverThreshold } : {}),
      gst_pct: 18,
    },
    forex_markup_pct: 3.5,
    ...(welcomeCondition ? { welcome: { condition: welcomeCondition } } : {}),
    accelerators,
    redemption,
    milestones,
    exclusions: [] as unknown[],
    meta: {
      last_verified: new Date().toISOString().slice(0, 10),
      owner: "mtuzo-import",
      confidence: "high" as const,
    },
    notes: notes.join(" "),
  };
  if (!waiverThreshold) delete (card.fee as Record<string, unknown>).waiver_threshold;

  notes.push(
    "forex_markup_pct is not exposed by this API — defaulted to 3.5%. Reward-earning exclusions (fuel/rent/wallet-load surcharge categories etc.) are also not exposed — none assumed.",
  );
  card.notes = notes.join(" ");

  return card;
}

/* ── main ───────────────────────────────────────────────────────────── */

function main() {
  const variants = loadBestVariants();
  console.log(`${variants.length} cards have usable mtuzo data`);

  const usedIds = new Set<string>();
  const cards = variants.map((v) => buildCard(v, usedIds));

  // back up and replace the existing catalog/cards directory
  const backupDir = path.join(__dirname, "..", `catalog-cards-backup-${Date.now()}`);
  renameSync(CARDS_DIR, backupDir);
  mkdirSync(CARDS_DIR, { recursive: true });

  for (const card of cards) {
    const header = `# ${card.name} — ${card.issuer}\n# GENERATED by scripts/build-catalog-from-mtuzo.ts from live mtuzo.net data.\n\n`;
    writeFileSync(path.join(CARDS_DIR, `${card.card_id}.yaml`), header + toYaml(card));
  }

  console.log(`Wrote ${cards.length} cards to catalog/cards/. Old catalog backed up to ${path.relative(process.cwd(), backupDir)}`);
}

main();
