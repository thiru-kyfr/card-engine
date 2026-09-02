/**
 * One-time pull of live benefits data from the mtuzo.net Benefits API,
 * driven by the user's kyfr-card-codes.xlsx (bank, card name, network, cardcode).
 *
 * Dedupes to one network variant per unique card name (first row wins),
 * fetches get_all_benefits (v7) for each, and caches the raw response to
 * scripts/.mtuzo-cache/<card_id>.json. A separate script (build-catalog-
 * from-mtuzo.ts) transforms the cache into catalog YAML — kept separate so
 * a partial/failed fetch run never forces a re-fetch of cards that already
 * succeeded.
 */
import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const file = path.join(__dirname, "..", ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].trim();
  }
}
loadEnvLocal();

const CODES_XLSX = process.argv[2];
if (!CODES_XLSX) {
  console.error("Usage: tsx scripts/fetch-mtuzo-benefits.ts <path-to-card-codes.xlsx>");
  process.exit(1);
}

const CACHE_DIR = path.join(__dirname, ".mtuzo-cache");
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

const CLIENTKEY = process.env.MTUZO_CLIENTKEY;
const CLIENTPASS = process.env.MTUZO_CLIENTPASS;
const APIKEY = process.env.MTUZO_APIKEY;
if (!CLIENTKEY || !CLIENTPASS || !APIKEY) {
  console.error("Missing MTUZO_CLIENTKEY / MTUZO_CLIENTPASS / MTUZO_APIKEY in .env.local");
  process.exit(1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface Row {
  bank: string;
  card: string;
  network: string;
  code: string;
}

async function readRows(file: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet("Sheet2");
  if (!ws) throw new Error("Sheet2 not found in " + file);
  const rows: Row[] = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values as unknown[];
    const bank = String(v[1] ?? "").trim();
    const card = String(v[2] ?? "").trim();
    const network = String(v[3] ?? "").trim();
    const code = String(v[4] ?? "").trim();
    if (bank && card && code) rows.push({ bank, card, network, code });
  });
  return rows;
}

// Data completeness varies by network variant for the SAME card — some
// codes return a fully populated response, siblings for the identical card
// return an empty shell. So every row gets fetched (not deduped by card);
// the build step picks whichever variant actually has data.

async function fetchBenefits(code: string): Promise<unknown> {
  const url = `https://mtuzo.net/api/v7/benefits/find?cardcode=${encodeURIComponent(code)}&action=get_all_benefits`;
  const res = await fetch(url, {
    headers: { clientkey: CLIENTKEY!, clientpass: CLIENTPASS!, apikey: APIKEY! },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { success: boolean; message: string | null };
  if (!json.success) throw new Error(json.message ?? "API returned success:false");
  return json;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const rows = await readRows(CODES_XLSX);
  console.log(`${rows.length} rows (bank+card+network variants) to fetch`);

  let ok = 0;
  let failed = 0;
  const failures: { card: string; error: string }[] = [];

  for (const [i, row] of rows.entries()) {
    const cardId = slugify(`${row.bank}-${row.card}-${row.network}`);
    const outFile = path.join(CACHE_DIR, `${cardId}.json`);
    if (existsSync(outFile)) {
      ok++;
      continue;
    }
    try {
      const data = await fetchBenefits(row.code);
      writeFileSync(outFile, JSON.stringify({ ...(data as object), _source_row: row }, null, 2));
      ok++;
      console.log(`[${i + 1}/${rows.length}] ok — ${row.bank} ${row.card}`);
    } catch (e) {
      failed++;
      failures.push({ card: `${row.bank} ${row.card}`, error: (e as Error).message });
      console.log(`[${i + 1}/${rows.length}] FAILED — ${row.bank} ${row.card}: ${(e as Error).message}`);
    }
    await sleep(150);
  }

  console.log(`\nDone. ${ok} ok, ${failed} failed.`);
  if (failures.length) {
    writeFileSync(path.join(CACHE_DIR, "_failures.json"), JSON.stringify(failures, null, 2));
    console.log("Failures written to scripts/.mtuzo-cache/_failures.json");
  }
}

main();
