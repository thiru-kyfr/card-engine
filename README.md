# Card Determination Engine

A deterministic, explainable credit-card recommendation engine and the website around it.

**The one architectural decision everything else follows from: it ranks in rupees, not in scores.**
A "match score of 87" is unauditable, untestable and unarguable. `NAV` — Net Annual Value — is
real money, so it can be regression-tested, inspected by a reviewer, and disputed by a user.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm test             # 48 engine tests
npm run typecheck    # tsc --noEmit
npm run build        # production build
npm start            # serve the production build
```

Node 20+ required (developed on 22).

---

## Scope — v1

This engine recommends a card to someone who **does not yet hold it**. That single assumption
removes a lot of machinery: there is no consumed-cap state, no statement date, no live balance.
Every month starts with the full cap available.

A "which of my cards should I swipe right now" engine is a *different* engine. Keep them
separate rather than retrofitting state into this one.

---

## Project layout

```
catalog/                     ← the data. Version-controlled, human-editable, never in code.
  engine.config.yaml           tunables: rank weights, tiebreak band, feature flags
  categories.yaml              canonical spend taxonomy + MCC mappings
  merchants.yaml               co-brand merchant picker list
  cards/<card_id>.yaml         one file per card → one reviewable PR per terms change

src/engine/                  ← pure functions. No I/O, no clock, no randomness.
  types.ts                     domain types
  schema.ts                    Zod validation for catalog AND request payloads
  gates.ts                     stage 1 — hard eligibility gates
  valuation.ts                 stages 3–4 — the five valuation layers
  fit.ts                       the tiebreak-only fit score
  rank.ts                      stage 5 — NAV sort + banded tiebreak
  explain.ts                   breakdown → sentences
  index.ts                     recommend(catalog, profile) → result

src/catalog/load.ts          ← reads + validates YAML at boot, caches, checks referential integrity
src/app/                     ← Next.js App Router pages and API routes
src/components/              ← the wizard, results view, debug console
scripts/import-xlsx.ts       ← spreadsheet → YAML converter
tests/engine.test.ts         ← 48 tests covering every layer and edge case
```

---

## The pipeline

```
0  normalize     profile → spend vector
1  hard gates    binary eligibility. Failures REMOVE the card, with a stated reason.
2  soft signals  reward-type preference selects the redemption channel
3  valuation     five layers, output in rupees
4  rank          NAV desc, then fit inside the tiebreak band
5  explain       generated from the same object that produced the rank
```

### The formula

**L1 — points per category, per month**

```
eligible   = min(spend[k], rule.cap)          // full cap: a fresh month
points[k]  = (eligible / denom) × base_rate × multiplier
           + ((spend[k] − eligible) / denom) × base_rate × post_cap_mult
           = 0   if k is excluded (zero_earn)
```

`post_cap_mult` is `1` when the card reverts to base past the cap and `0` when it stops earning
entirely. That one field separates a good card from a trap, and it is almost never stated
clearly in the terms.

A **points** cap is back-solved into the equivalent qualifying spend.

**L2 — points to rupees**

```
rate   = card.redemption[user.preferred_channel] ?? default ?? best_paying
value  = Σ points[k] × rate
```

The redemption channel is the most under-modelled input in this whole category. Two cards with
identical earn rates can differ 3× on value purely on where the points come out.

**L3 — annualize, add milestones**

```
milestone = Σ m.value_inr  where annual_spend ≥ m.threshold
gross     = 12 × value + milestone
```

**L4 — subtract the true cost**

```
eff_fee = 0                       if annual_spend ≥ waiver_threshold
        = fee × (1 + gst_pct/100) otherwise
NAV     = gross − eff_fee − (forex_markup_pct × international_spend)
```

**L5 — rank, then break ties on fit**

```
sort by NAV desc
if (NAV_anchor − NAV_b) / NAV_anchor < tiebreak_band:
    order that cluster by fit_score

fit_score = 0.60 × category_coverage + 0.25 × reward_type_match + 0.15 × merchant_overlap

category_coverage = Σ rank_weight[i] × accelerates(card, category[i]) / Σ rank_weight[i]
rank_weight       = [3, 2, 1]
```

---

## Why there is no positional weighting in NAV

**The rupee amounts already are the weights.** Someone spending ₹20,000 on dining and ₹5,000 on
travel already has dining influencing their NAV four times as much, because it generates four
times the points. Applying a positional multiplier (50/30/20 or similar) on top would count the
same ranking twice — and it would stop NAV being real money, which is the property the whole
design rests on.

Positional weights `3/2/1` apply in **exactly one place**: the tiebreak, where we are no longer
measuring money. Blunt integers are right there — a tiebreak signal should be stable against
small errors in self-reported amounts, because the precise tracking already happened in NAV.

Collecting rupee amounts rather than a ranked list is what buys the right to skip positional
weighting. It is the more expensive question to ask, and this is why it is worth it.

---

## Known v1 biases — deliberate, documented, revisit later

Each of these is a decision, not an oversight. Every one will eventually show up as a pattern in
the results, so they are written down rather than forgotten.

| Cut | Handled as | The trade-off you are accepting |
|---|---|---|
| **Credit score** | not collected | **The only cut that can leave a user worse off.** The engine will sometimes recommend a card they are rejected for, and a rejection is a hard enquiry that dents their score. Cheapest way back: an optional four-bucket question used as a *display-only* likelihood label, never as a gate. |
| **Fee waiver at the gate** | hard filter on sticker fee | Drops premium cards that would genuinely have been free at the user's spend. The waiver still reduces the cost inside NAV — the gate asks "will they pay ₹10,000?", the cost line asks "will they be charged it?" |
| **Redemption friction** | removed | Miles-heavy cards look better than they will perform; the model assumes every user executes the optimal airline transfer. Watch for premium travel cards sweeping every result. Re-enable via `redemption_friction_enabled`. |
| **Benefits (lounge, insurance)** | excluded from NAV | Premium cards systematically under-rank. This is the honest direction to be wrong in — better to under-sell a perk than book value the user never collects. |
| **Existing cards held** | not asked | Every recommendation is absolute rather than marginal. A second card duplicating the first's categories is worth far less than its NAV suggests. |
| **Welcome bonus** | separate first-year line | Never lets a one-time bonus win a steady-state comparison. Toggle with `welcome_bonus_in_nav`. |

The flags in `catalog/engine.config.yaml` turn several of these back on without a code change.

---

## The residual bucket

The form collects three named categories plus a mandatory **"everything else"** figure. The
residual always earns base rate in v1 (`residual_treatment: base_rate`), which means the engine
**systematically under-values cards whose accelerators fall outside the named three**.

That is the conservative, always-defensible choice. The mitigation is a product one: when a
top-ranked card has a strong accelerator on a category the user never named, surface it —
*"this card also gives 5× on groceries. Spend much there?"* — and let them add a fourth category
in one tap.

The engine already emits a warning when `residual > max(named_amounts)`, because at that point
the "top three" are not actually the top three and every accelerator comparison is built on the
wrong vector.

---

## Loading real card data

### Option A — from the spreadsheet (recommended)

```bash
npm run import:xlsx -- path/to/card_engine_catalog.xlsx          # writes into catalog/
npm run import:xlsx -- path/to/card_engine_catalog.xlsx --dry    # validate only
npm run import:xlsx -- path/to/card_engine_catalog.xlsx --out /tmp/out
```

Every row is validated against the **same Zod schemas the engine uses at boot**, so a bad row
fails here with a sheet name and row number instead of silently scoring wrong later. **Nothing is
written unless every sheet passes.** Cards removed from the sheet have their YAML deleted, so
deletions propagate.

The importer tolerates workbooks re-saved by Excel, Google Sheets, LibreOffice or openpyxl — it
strips cell comments from the archive if the reader trips on them.

Expected sheets: `cards`, `accelerators`, `redemption`, `milestones`, `exclusions`, `categories`,
`merchants`, `engine_config`. Parent/child sheets are joined on `card_id`.

**Pipe-delimited lists, never commas** — commas appear inside merchant and category names.
`allowed_employment`, `mcc_codes`, `aliases`, `partner_list` all use `|`.

**Blank ≠ zero.** A blank cell means "omit this key"; `0` means the value is genuinely zero.
Blank `fee_waiver_annual_spend_inr` = no waiver exists. `0` would mean waived at zero spend.

### Option B — hand-written YAML

Drop a file in `catalog/cards/`. It is validated at boot; a malformed card throws with a list of
problems rather than starting with a silently broken catalog.

### Catalog integrity checks at boot

- every card parses against the schema
- exactly one `is_default` redemption channel per card
- no duplicate `card_id`, accelerator id, or redemption channel
- every accelerator and exclusion targets a real `category_id`
- every `cobrand_card_id` resolves to a real card
- the residual category `other` exists
- `min_income` is present for every allowed employment type

---

## API

### `POST /api/recommend`

```jsonc
{
  "age": 30,
  "employment": "salaried",            // salaried | self_employed | student
  "annual_income_inr": 1200000,
  "spend": [
    { "category_id": "dining", "monthly_inr": 8000 },
    { "category_id": "online_shopping", "monthly_inr": 12000 },
    { "category_id": "travel_air", "monthly_inr": 5000 }
  ],
  "residual_monthly_inr": 15000,
  "preferred_channel": "voucher",      // cashback | voucher | portal | airmiles | merchandise
  "fee_comfort_inr": 5000,
  "frequent_merchants": ["amazon"]
}
```

Returns `{ ranked[], gated[], warnings[], meta }`. Each ranked entry carries the full breakdown
tree — per-category points, cap overflow, channel and rate, milestones, fee, NAV, fit — plus a
generated explanation.

| Status | Meaning |
|---|---|
| `200` | ranked result |
| `400` | body was not valid JSON |
| `422` | profile failed validation, or referenced an unknown category (details included) |
| `500` | catalog failed to load (details included) |

### `GET /api/catalog`

Selectable categories, picker merchants, active cards, and the live engine config.

---

## Pages

| Route | What it is |
|---|---|
| `/` | Landing, with live catalog counts and a staleness indicator |
| `/recommend` | Three-step wizard → ranked results with the full arithmetic expandable per card |
| `/catalog` | Every card exactly as the YAML defines it, plus the spend taxonomy and MCC mappings |
| `/catalog/[cardId]` | Full terms for one card: accelerators, caps, post-cap behaviour, redemption ladder, exclusions, metadata |
| `/debug` | Post any profile at the engine and read the raw ranked output. Six presets covering the awkward cases. |

`/debug` is the page you will live in when real card data goes in. `/catalog` is where the answer
usually is when a recommendation looks wrong — nine times out of ten it is the data, not the
engine.

---

## Testing

```bash
npm test
```

48 tests covering: catalog integrity, spend caps, points-cap back-solving, `post_cap = 0`,
uncapped accelerators, both exclusion treatments, `multiplier_basis`, channel fallback, milestone
firing, fee waiver and GST, forex, every gate, employment-specific income floors, fit weighting,
tiebreak banding (including the negative-NAV case), determinism, and the empty-state paths.

Two invariants are asserted across every card in every end-to-end run:

```
NAV   == gross − effective_fee − forex_cost
gross == annual_rewards + milestone_value
```

**Next test to add once real data lands:** golden snapshots. Commit ~50 synthetic personas ×
every card and diff the output on each catalog PR. Someone fat-fingers a cap from ₹20,000 to
₹2,00,000 and the diff screams before it ships. Without it, a one-character config typo silently
reorders every recommendation you serve.

---

## Deliberately not built yet

- **ML ranking.** There are no outcome labels yet. Ship deterministic, collect "applied /
  approved / still active at month 12", then use ML to *re-rank the top 5* — never to generate
  the value number.
- **Live transaction ingestion.** Makes cap-tracking real, but it is a compliance project.
- **Persistence.** The app is stateless by design. The engine is a pure function, so adding a
  database later changes nothing inside it.
- **Admin catalog editor.** Works against the "catalog as reviewable YAML in git" principle.

## The metric to instrument from day one

Not click-through, not applications. **Realized value at month 12** — did the user actually earn
what the engine predicted? It is the only number that says whether the model is right, almost
nobody in this category measures it, and it is the entire differentiation story.

---

*The bundled catalog is dummy data for engine development. Figures are illustrative structures,
not any issuer's real terms.*
