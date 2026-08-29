/**
 * Converts card_engine_catalog.xlsx into the YAML files the engine reads.
 *
 *   npm run import:xlsx -- path/to/card_engine_catalog.xlsx [--out catalog] [--dry]
 *
 * Every row is validated against the same Zod schemas the engine uses at boot,
 * so a bad row fails here with a row number rather than silently scoring wrong
 * later. Nothing is written unless every sheet passes.
 */
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { stringify as toYaml } from "yaml";
import { writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  cardSchema,
  categorySchema,
  merchantSchema,
  engineConfigSchema,
} from "../src/engine/schema";

/* ── tiny arg parsing ─────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const xlsxPath = argv.find((a) => !a.startsWith("--"));
const outDir = (() => {
  const i = argv.indexOf("--out");
  return i >= 0 && argv[i + 1] ? argv[i + 1] : "catalog";
})();
const dryRun = argv.includes("--dry");

if (!xlsxPath) {
  console.error("Usage: npm run import:xlsx -- <file.xlsx> [--out catalog] [--dry]");
  process.exit(1);
}
if (!existsSync(xlsxPath)) {
  console.error(`File not found: ${xlsxPath}`);
  process.exit(1);
}

/* ── workbook loading ─────────────────────────────────────────────── */

/**
 * Strips cell comments from the archive before ExcelJS parses it.
 *
 * ExcelJS expects Excel's `xl/comments1.xml` naming and crashes on the
 * `xl/comments/comment1.xml` layout that openpyxl (and some other writers)
 * produce. Comments are documentation for whoever fills in the sheet — the
 * importer never reads them — so dropping them makes the load robust across
 * whatever tool last saved the file.
 */
async function loadWorkbook(file: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const original = readFileSync(file);

  try {
    await wb.xlsx.load(original as unknown as ArrayBuffer);
    return wb;
  } catch (firstError) {
    let sanitized: Buffer;
    try {
      const zip = await JSZip.loadAsync(original);
      const drop = Object.keys(zip.files).filter((f) =>
        /^xl\/comments|^xl\/threadedComments|vmlDrawing|commentsDrawing|\.vml$/i.test(f),
      );
      if (drop.length === 0) throw firstError;
      for (const f of drop) zip.remove(f);

      // Remove references to the parts we just deleted, or the reader will
      // follow a dangling relationship and fail the same way.
      const scrub = async (name: string, patterns: RegExp[]) => {
        const entry = zip.file(name);
        if (!entry) return;
        let xml = await entry.async("string");
        for (const p of patterns) xml = xml.replace(p, "");
        zip.file(name, xml);
      };

      await scrub("[Content_Types].xml", [
        /<Override[^>]*(?:comments|vml)[^>]*\/>/gi,
        /<Default[^>]*vml[^>]*\/>/gi,
      ]);

      for (const relName of Object.keys(zip.files).filter((f) =>
        /^xl\/worksheets\/_rels\/.*\.rels$/i.test(f),
      )) {
        await scrub(relName, [/<Relationship[^>]*(?:comment|vml)[^>]*\/>/gi]);
      }
      for (const sheetName of Object.keys(zip.files).filter((f) =>
        /^xl\/worksheets\/sheet\d+\.xml$/i.test(f),
      )) {
        await scrub(sheetName, [/<legacyDrawing[^>]*\/>/gi]);
      }

      sanitized = await zip.generateAsync({ type: "nodebuffer" });
    } catch {
      throw firstError;
    }

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(sanitized as unknown as ArrayBuffer);
    console.log("  (note: cell comments were stripped to read this file — data is unaffected)");
    return wb2;
  }
}

/* ── cell helpers ─────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ("result" in v) return (v as { result: unknown }).result; // formula cell
    if ("text" in v) return (v as { text: string }).text; // rich text / hyperlink
    if ("richText" in v)
      return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return v;
}

function readSheet(wb: ExcelJS.Workbook, name: string, required = true): Row[] {
  const ws = wb.getWorksheet(name);
  if (!ws) {
    if (required) throw new Error(`Sheet '${name}' not found in the workbook.`);
    return [];
  }
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cellValue(cell) ?? "").trim();
  });

  const rows: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Row = { __row: rowNumber };
    let any = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key || key === "validation") return;
      const val = cellValue(cell);
      if (val !== undefined && val !== "") {
        obj[key] = val;
        any = true;
      }
    });
    if (any) rows.push(obj);
  });
  return rows;
}

const str = (v: unknown): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};
const num = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown): boolean | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;
  return undefined;
};
/** Pipe-delimited list. Commas are NOT separators — they appear inside names. */
const list = (v: unknown): string[] | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const parts = s.split("|").map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
};

/** Drops undefined keys so they are omitted from YAML rather than emitted as null. */
function clean<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/* ── main ─────────────────────────────────────────────────────────── */

async function main() {
  const wb = await loadWorkbook(xlsxPath!);

  const errors: string[] = [];
  const push = (sheet: string, row: unknown, msg: string) =>
    errors.push(`${sheet} row ${row}: ${msg}`);

  /* categories */
  const categories = readSheet(wb, "categories").map((r) =>
    clean({
      category_id: str(r.category_id),
      display_name: str(r.display_name),
      parent_category: str(r.parent_category),
      mcc_codes: list(r.mcc_codes),
      mapping_confidence: str(r.mapping_confidence) ?? "medium",
      is_selectable_in_form: bool(r.is_selectable_in_form) ?? true,
      form_display_order: num(r.form_display_order),
      commonly_excluded: bool(r.commonly_excluded),
      notes: str(r.notes),
      __row: r.__row,
    }),
  );
  const parsedCategories = categories.map((c) => {
    const { __row, ...rest } = c as Record<string, unknown>;
    const p = categorySchema.safeParse(rest);
    if (!p.success)
      p.error.issues.forEach((i) => push("categories", __row, `${i.path.join(".")} — ${i.message}`));
    return p.success ? p.data : null;
  });

  /* merchants */
  const merchants = readSheet(wb, "merchants").map((r) =>
    clean({
      merchant_id: str(r.merchant_id),
      display_name: str(r.display_name),
      category_id: str(r.category_id),
      aliases: list(r.aliases),
      has_cobrand_card: bool(r.has_cobrand_card) ?? false,
      cobrand_card_id: str(r.cobrand_card_id),
      show_in_picker: bool(r.show_in_picker) ?? true,
      notes: str(r.notes),
      __row: r.__row,
    }),
  );
  const parsedMerchants = merchants.map((m) => {
    const { __row, ...rest } = m as Record<string, unknown>;
    const p = merchantSchema.safeParse(rest);
    if (!p.success)
      p.error.issues.forEach((i) => push("merchants", __row, `${i.path.join(".")} — ${i.message}`));
    return p.success ? p.data : null;
  });

  /* engine config: key/value rows → object */
  const cfgRows = readSheet(wb, "engine_config", false);
  const cfgObj: Record<string, unknown> = {};
  for (const r of cfgRows) {
    const key = str(r.param_key);
    if (!key) continue;
    const type = str(r.type);
    const raw = r.value;
    if (type === "number") cfgObj[key] = num(raw);
    else if (type === "boolean") cfgObj[key] = bool(raw);
    else cfgObj[key] = str(raw);
  }
  // Values the engine needs but the sheet stores elsewhere / not at all.
  delete cfgObj.prompt_fourth_category_rule;
  const cfgParsed = engineConfigSchema.safeParse(cfgObj);
  if (!cfgParsed.success)
    cfgParsed.error.issues.forEach((i) =>
      errors.push(`engine_config: ${i.path.join(".")} — ${i.message}`),
    );

  /* child sheets, grouped by card_id */
  const accRows = readSheet(wb, "accelerators", false);
  const redRows = readSheet(wb, "redemption", false);
  const msRows = readSheet(wb, "milestones", false);
  const exRows = readSheet(wb, "exclusions", false);

  const byCard = <T extends Row>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const id = str(r.card_id);
      if (!id) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(r);
    }
    return m;
  };
  const accBy = byCard(accRows);
  const redBy = byCard(redRows);
  const msBy = byCard(msRows);
  const exBy = byCard(exRows);

  /* cards */
  const cardRows = readSheet(wb, "cards");
  const cards: Record<string, unknown>[] = [];

  for (const r of cardRows) {
    const id = str(r.card_id);
    if (!id) {
      push("cards", r.__row, "card_id is required");
      continue;
    }

    const minIncome: Record<string, number> = {};
    const sal = num(r.min_income_salaried_inr);
    const se = num(r.min_income_self_employed_inr);
    const st = num(r.min_income_student_inr);
    if (sal !== undefined) minIncome.salaried = sal;
    if (se !== undefined) minIncome.self_employed = se;
    if (st !== undefined) minIncome.student = st;

    const card = clean({
      card_id: id,
      name: str(r.card_name),
      issuer: str(r.issuer),
      network: clean({ name: str(r.network), tier: str(r.network_tier) }),
      tier: str(r.card_tier),
      status: str(r.status) ?? "active",
      gates: clean({
        min_age: num(r.min_age),
        max_age: num(r.max_age),
        allowed_employment: list(r.allowed_employment),
        min_income: minIncome,
      }),
      base: clean({
        points_per_unit: num(r.base_points_per_unit),
        unit_inr: num(r.base_unit_inr),
        currency: str(r.points_currency) ?? "points",
      }),
      fee: clean({
        annual: num(r.annual_fee_inr) ?? 0,
        joining: num(r.joining_fee_inr),
        waiver_threshold: num(r.fee_waiver_annual_spend_inr),
        gst_pct: num(r.gst_pct) ?? 18,
      }),
      forex_markup_pct: num(r.forex_markup_pct) ?? 3.5,
      welcome: (() => {
        const pts = num(r.welcome_bonus_points);
        const cond = str(r.welcome_bonus_condition);
        return pts || cond ? clean({ points: pts, condition: cond }) : undefined;
      })(),
      points_expiry_months: num(r.points_expiry_months),

      accelerators: (accBy.get(id) ?? []).map((a) =>
        clean({
          id: str(a.rule_id),
          scope: { type: str(a.scope_type) ?? "category", value: str(a.scope_value) },
          multiplier: num(a.multiplier),
          basis: str(a.multiplier_basis) ?? "total",
          cap: clean({
            type: str(a.cap_type) ?? "none",
            value: num(a.cap_value),
            window: str(a.cap_window) ?? "statement_cycle",
          }),
          post_cap: num(a.post_cap_multiplier),
          valid_from: str(a.valid_from),
          valid_to: str(a.valid_to),
          priority: num(a.priority) ?? 3,
          notes: str(a.notes),
        }),
      ),
      redemption: (redBy.get(id) ?? []).map((x) =>
        clean({
          channel: str(x.channel),
          inr_per_point: num(x.inr_per_point),
          min_points: num(x.min_points_to_redeem),
          fee: num(x.redemption_fee_inr),
          transfer_ratio: str(x.transfer_ratio),
          partners: list(x.partner_list),
          is_default: bool(x.is_default_channel) ?? false,
        }),
      ),
      milestones: (msBy.get(id) ?? []).map((m) =>
        clean({
          id: str(m.milestone_id),
          threshold: num(m.threshold_annual_spend_inr),
          reward_type: str(m.reward_type),
          value_inr: num(m.reward_value_inr),
          window: str(m.window) ?? "annual",
          cumulative: bool(m.is_cumulative) ?? true,
          notes: str(m.notes),
        }),
      ),
      exclusions: (exBy.get(id) ?? []).map((e) =>
        clean({
          category: str(e.category_id),
          treatment: str(e.treatment) ?? "zero_earn",
          notes: str(e.notes),
        }),
      ),
      meta: clean({
        terms_url: str(r.terms_url),
        effective_date: str(r.terms_effective_date),
        last_verified: str(r.last_verified_date),
        owner: str(r.data_owner),
        confidence: str(r.confidence) ?? "medium",
      }),
      notes: str(r.notes),
    });

    const parsed = cardSchema.safeParse(card);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) =>
        push("cards", r.__row, `[${id}] ${i.path.join(".") || "(root)"} — ${i.message}`),
      );
      continue;
    }
    cards.push(card);
  }

  /* referential integrity — same checks the loader runs at boot */
  const catIds = new Set(parsedCategories.filter(Boolean).map((c) => c!.category_id));
  const cardIds = new Set(cards.map((c) => c.card_id as string));
  for (const c of cards) {
    for (const a of c.accelerators as { id: string; scope: { type: string; value: string } }[]) {
      if (a.scope.type === "category" && !catIds.has(a.scope.value))
        errors.push(`cards[${c.card_id}]: accelerator '${a.id}' → unknown category '${a.scope.value}'`);
    }
    for (const e of c.exclusions as { category: string }[]) {
      if (!catIds.has(e.category))
        errors.push(`cards[${c.card_id}]: exclusion → unknown category '${e.category}'`);
    }
  }
  for (const m of parsedMerchants.filter(Boolean)) {
    if (!catIds.has(m!.category_id))
      errors.push(`merchants[${m!.merchant_id}]: unknown category '${m!.category_id}'`);
    if (m!.cobrand_card_id && !cardIds.has(m!.cobrand_card_id))
      errors.push(`merchants[${m!.merchant_id}]: unknown cobrand_card_id '${m!.cobrand_card_id}'`);
  }
  if (!catIds.has("other")) errors.push("categories: the residual category 'other' is required");

  /* report */
  if (errors.length > 0) {
    console.error(`\n✗ Import failed — ${errors.length} problem(s). Nothing was written.\n`);
    errors.slice(0, 60).forEach((e) => console.error("  • " + e));
    if (errors.length > 60) console.error(`  … and ${errors.length - 60} more`);
    console.error("");
    process.exit(1);
  }

  console.log(
    `\n✓ Validated: ${cards.length} cards · ${catIds.size} categories · ${parsedMerchants.length} merchants`,
  );

  if (dryRun) {
    console.log("  --dry set, nothing written.\n");
    return;
  }

  /* write */
  const cardsDir = path.join(outDir, "cards");
  mkdirSync(cardsDir, { recursive: true });
  // Remove YAML for cards no longer in the sheet, so deletions propagate.
  for (const f of readdirSync(cardsDir).filter((f) => f.endsWith(".yaml"))) {
    if (!cardIds.has(f.replace(/\.yaml$/, ""))) rmSync(path.join(cardsDir, f));
  }

  const header = (t: string) =>
    `# ${t}\n# GENERATED by scripts/import-xlsx.ts — edit the spreadsheet, not this file.\n\n`;

  writeFileSync(
    path.join(outDir, "categories.yaml"),
    header("Spend taxonomy") + toYaml(parsedCategories.filter(Boolean)),
  );
  writeFileSync(
    path.join(outDir, "merchants.yaml"),
    header("Merchant picker") + toYaml(parsedMerchants.filter(Boolean)),
  );
  if (cfgParsed.success) {
    writeFileSync(
      path.join(outDir, "engine.config.yaml"),
      header("Engine tunables") + toYaml(cfgParsed.data),
    );
  }
  for (const c of cards) {
    writeFileSync(
      path.join(cardsDir, `${c.card_id}.yaml`),
      header(`${c.name} — ${c.issuer}`) + toYaml(c),
    );
  }

  console.log(`  Written to ${outDir}/\n`);
}

main().catch((e) => {
  console.error("\n✗ Import crashed:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
