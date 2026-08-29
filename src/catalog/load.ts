import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  cardSchema,
  categorySchema,
  engineConfigSchema,
  merchantSchema,
} from "@/engine/schema";
import type { Catalog, Card, Category, Merchant, EngineConfig } from "@/engine/types";

const CATALOG_DIR = path.join(process.cwd(), "catalog");

export class CatalogError extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
    this.name = "CatalogError";
  }
}

function readYaml(file: string): unknown {
  if (!existsSync(file)) throw new CatalogError(`Catalog file missing: ${path.basename(file)}`);
  try {
    return parseYaml(readFileSync(file, "utf8"));
  } catch (e) {
    throw new CatalogError(
      `Could not parse ${path.basename(file)} as YAML`,
      [(e as Error).message],
    );
  }
}

function issues(prefix: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${prefix}: ${i.path.join(".") || "(root)"} — ${i.message}`);
}

let cached: Catalog | null = null;

/**
 * Loads and validates the whole catalog. Throws on ANY invalid record — a
 * malformed card must fail loudly at boot, never score silently wrong at
 * request time. Cached after the first successful load.
 */
export function loadCatalog(force = false): Catalog {
  if (cached && !force) return cached;

  const errors: string[] = [];

  // ── config ──
  const configRaw = readYaml(path.join(CATALOG_DIR, "engine.config.yaml"));
  const configParsed = engineConfigSchema.safeParse(configRaw ?? {});
  if (!configParsed.success) errors.push(...issues("engine.config.yaml", configParsed.error));
  const config = (configParsed.success ? configParsed.data : {}) as EngineConfig;

  // ── categories ──
  const catRaw = readYaml(path.join(CATALOG_DIR, "categories.yaml"));
  const catParsed = z.array(categorySchema).safeParse(catRaw);
  if (!catParsed.success) errors.push(...issues("categories.yaml", catParsed.error));
  const categories = (catParsed.success ? catParsed.data : []) as Category[];

  // ── merchants ──
  const merRaw = readYaml(path.join(CATALOG_DIR, "merchants.yaml"));
  const merParsed = z.array(merchantSchema).safeParse(merRaw);
  if (!merParsed.success) errors.push(...issues("merchants.yaml", merParsed.error));
  const merchants = (merParsed.success ? merParsed.data : []) as Merchant[];

  // ── cards ──
  const cardsDir = path.join(CATALOG_DIR, "cards");
  if (!existsSync(cardsDir)) throw new CatalogError("catalog/cards directory is missing");
  const files = readdirSync(cardsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const cards: Card[] = [];
  for (const f of files) {
    const raw = readYaml(path.join(cardsDir, f));
    const parsed = cardSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(...issues(`cards/${f}`, parsed.error));
      continue;
    }
    cards.push(parsed.data as Card);
  }

  // ── referential integrity ──
  const catIds = new Set(categories.map((c) => c.category_id));
  const cardIds = new Set(cards.map((c) => c.card_id));

  if (cardIds.size !== cards.length) {
    const seen = new Set<string>();
    for (const c of cards) {
      if (seen.has(c.card_id)) errors.push(`duplicate card_id: ${c.card_id}`);
      seen.add(c.card_id);
    }
  }
  for (const card of cards) {
    for (const a of card.accelerators) {
      if (a.scope.type === "category" && !catIds.has(a.scope.value)) {
        errors.push(
          `cards/${card.card_id}: accelerator '${a.id}' targets unknown category '${a.scope.value}'`,
        );
      }
    }
    for (const e of card.exclusions) {
      if (!catIds.has(e.category)) {
        errors.push(`cards/${card.card_id}: exclusion targets unknown category '${e.category}'`);
      }
    }
  }
  for (const m of merchants) {
    if (!catIds.has(m.category_id)) {
      errors.push(`merchants: '${m.merchant_id}' targets unknown category '${m.category_id}'`);
    }
    if (m.cobrand_card_id && !cardIds.has(m.cobrand_card_id)) {
      errors.push(
        `merchants: '${m.merchant_id}' references unknown cobrand_card_id '${m.cobrand_card_id}'`,
      );
    }
  }
  if (!catIds.has("other")) {
    errors.push("categories.yaml must define the residual category 'other'");
  }

  if (errors.length > 0) {
    throw new CatalogError(`Catalog failed validation (${errors.length} problem(s))`, errors);
  }

  cached = { cards, categories, merchants, config };
  return cached;
}

/** Categories offered in the user-facing picker, in display order. */
export function selectableCategories(catalog: Catalog): Category[] {
  return catalog.categories
    .filter((c) => c.is_selectable_in_form && c.category_id !== "other")
    .sort(
      (a, b) =>
        (a.form_display_order ?? 999) - (b.form_display_order ?? 999) ||
        a.display_name.localeCompare(b.display_name),
    );
}

/** Merchants offered in the frequent-merchant picker. */
export function pickerMerchants(catalog: Catalog): Merchant[] {
  return catalog.merchants
    .filter((m) => m.show_in_picker)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/** Cards whose terms are older than the configured staleness window. */
export function staleCards(catalog: Catalog): Card[] {
  const limit = catalog.config.catalog_staleness_alert_days;
  const now = Date.now();
  return catalog.cards.filter((c) => {
    if (!c.meta.last_verified) return true;
    const t = Date.parse(c.meta.last_verified);
    if (Number.isNaN(t)) return true;
    return (now - t) / 86_400_000 > limit;
  });
}
