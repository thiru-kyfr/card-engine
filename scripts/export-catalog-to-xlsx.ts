/**
 * Exports the full catalog/cards/*.yaml data set into one Excel workbook
 * for manual cross-verification against the source (mtuzo.net) — every
 * field the engine actually uses, not just a summary.
 *
 * One "Cards" sheet with all scalar fields (one row per card), plus three
 * normalized detail sheets (Accelerators / Redemption / Milestones) since
 * those are variable-length arrays per card.
 */
import ExcelJS from "exceljs";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const CARDS_DIR = path.join(__dirname, "..", "catalog", "cards");
const OUT_FILE = path.join(__dirname, "..", "kyfr-catalog-export.xlsx");

function loadCards() {
  const files = readdirSync(CARDS_DIR).filter((f) => f.endsWith(".yaml")).sort();
  return files.map((f) => parseYaml(readFileSync(path.join(CARDS_DIR, f), "utf8")));
}

function autoFit(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E4F7" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

async function main() {
  const cards = loadCards();
  const wb = new ExcelJS.Workbook();
  wb.creator = "card-engine export-catalog-to-xlsx.ts";
  wb.created = new Date();

  /* ── Cards sheet ── */
  const cardsSheet = wb.addWorksheet("Cards");
  cardsSheet.columns = [
    { header: "card_id", key: "card_id" },
    { header: "name", key: "name" },
    { header: "issuer", key: "issuer" },
    { header: "network", key: "network" },
    { header: "tier", key: "tier" },
    { header: "status", key: "status" },
    { header: "min_age", key: "min_age" },
    { header: "max_age", key: "max_age" },
    { header: "allowed_employment", key: "allowed_employment" },
    { header: "min_income_salaried", key: "min_income_salaried" },
    { header: "min_income_self_employed", key: "min_income_self_employed" },
    { header: "base_points_per_unit", key: "base_points_per_unit" },
    { header: "base_unit_inr", key: "base_unit_inr" },
    { header: "base_currency", key: "base_currency" },
    { header: "base_rate_pct", key: "base_rate_pct" },
    { header: "fee_annual", key: "fee_annual" },
    { header: "fee_joining", key: "fee_joining" },
    { header: "fee_waiver_threshold", key: "fee_waiver_threshold" },
    { header: "gst_pct", key: "gst_pct" },
    { header: "forex_markup_pct", key: "forex_markup_pct" },
    { header: "welcome_condition", key: "welcome_condition" },
    { header: "accelerator_count", key: "accelerator_count" },
    { header: "redemption_channels", key: "redemption_channels" },
    { header: "milestone_count", key: "milestone_count" },
    { header: "exclusion_count", key: "exclusion_count" },
    { header: "last_verified", key: "last_verified" },
    { header: "owner", key: "owner" },
    { header: "confidence", key: "confidence" },
    { header: "notes", key: "notes" },
  ];
  for (const c of cards) {
    cardsSheet.addRow({
      card_id: c.card_id,
      name: c.name,
      issuer: c.issuer,
      network: c.network?.name,
      tier: c.tier,
      status: c.status,
      min_age: c.gates?.min_age,
      max_age: c.gates?.max_age,
      allowed_employment: (c.gates?.allowed_employment ?? []).join(", "),
      min_income_salaried: c.gates?.min_income?.salaried,
      min_income_self_employed: c.gates?.min_income?.self_employed,
      base_points_per_unit: c.base?.points_per_unit,
      base_unit_inr: c.base?.unit_inr,
      base_currency: c.base?.currency,
      base_rate_pct: c.base ? Math.round((c.base.points_per_unit / c.base.unit_inr) * 10000) / 100 : undefined,
      fee_annual: c.fee?.annual,
      fee_joining: c.fee?.joining,
      fee_waiver_threshold: c.fee?.waiver_threshold,
      gst_pct: c.fee?.gst_pct,
      forex_markup_pct: c.forex_markup_pct,
      welcome_condition: c.welcome?.condition,
      accelerator_count: (c.accelerators ?? []).length,
      redemption_channels: (c.redemption ?? []).map((r: any) => `${r.channel}${r.is_default ? "*" : ""}`).join(", "),
      milestone_count: (c.milestones ?? []).length,
      exclusion_count: (c.exclusions ?? []).length,
      last_verified: c.meta?.last_verified,
      owner: c.meta?.owner,
      confidence: c.meta?.confidence,
      notes: c.notes,
    });
  }
  styleHeader(cardsSheet);
  autoFit(cardsSheet);

  /* ── Accelerators sheet ── */
  const accSheet = wb.addWorksheet("Accelerators");
  accSheet.columns = [
    { header: "card_id", key: "card_id" },
    { header: "card_name", key: "card_name" },
    { header: "id", key: "id" },
    { header: "category", key: "category" },
    { header: "multiplier", key: "multiplier" },
    { header: "basis", key: "basis" },
    { header: "cap_type", key: "cap_type" },
    { header: "cap_value", key: "cap_value" },
    { header: "cap_window", key: "cap_window" },
    { header: "post_cap", key: "post_cap" },
    { header: "priority", key: "priority" },
    { header: "notes", key: "notes" },
  ];
  for (const c of cards) {
    for (const a of c.accelerators ?? []) {
      accSheet.addRow({
        card_id: c.card_id,
        card_name: c.name,
        id: a.id,
        category: a.scope?.value,
        multiplier: a.multiplier,
        basis: a.basis,
        cap_type: a.cap?.type,
        cap_value: a.cap?.value,
        cap_window: a.cap?.window,
        post_cap: a.post_cap,
        priority: a.priority,
        notes: a.notes,
      });
    }
  }
  styleHeader(accSheet);
  autoFit(accSheet);

  /* ── Redemption sheet ── */
  const redSheet = wb.addWorksheet("Redemption");
  redSheet.columns = [
    { header: "card_id", key: "card_id" },
    { header: "card_name", key: "card_name" },
    { header: "channel", key: "channel" },
    { header: "inr_per_point", key: "inr_per_point" },
    { header: "is_default", key: "is_default" },
    { header: "min_points", key: "min_points" },
    { header: "fee", key: "fee" },
  ];
  for (const c of cards) {
    for (const r of c.redemption ?? []) {
      redSheet.addRow({
        card_id: c.card_id,
        card_name: c.name,
        channel: r.channel,
        inr_per_point: r.inr_per_point,
        is_default: r.is_default,
        min_points: r.min_points,
        fee: r.fee,
      });
    }
  }
  styleHeader(redSheet);
  autoFit(redSheet);

  /* ── Milestones sheet ── */
  const msSheet = wb.addWorksheet("Milestones");
  msSheet.columns = [
    { header: "card_id", key: "card_id" },
    { header: "card_name", key: "card_name" },
    { header: "id", key: "id" },
    { header: "threshold", key: "threshold" },
    { header: "reward_type", key: "reward_type" },
    { header: "value_inr", key: "value_inr" },
    { header: "window", key: "window" },
    { header: "cumulative", key: "cumulative" },
  ];
  for (const c of cards) {
    for (const m of c.milestones ?? []) {
      msSheet.addRow({
        card_id: c.card_id,
        card_name: c.name,
        id: m.id,
        threshold: m.threshold,
        reward_type: m.reward_type,
        value_inr: m.value_inr,
        window: m.window,
        cumulative: m.cumulative,
      });
    }
  }
  styleHeader(msSheet);
  autoFit(msSheet);

  await wb.xlsx.writeFile(OUT_FILE);
  console.log(`Wrote ${cards.length} cards to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  Accelerators: ${accSheet.rowCount - 1}`);
  console.log(`  Redemption options: ${redSheet.rowCount - 1}`);
  console.log(`  Milestones: ${msSheet.rowCount - 1}`);
}

main();
