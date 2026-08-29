import Link from "next/link";
import { loadCatalog, CatalogError, staleCards } from "@/catalog/load";
import { formatInr, formatLakh } from "@/engine/format";
import { Card, Callout, Pill, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

const TIER_ORDER = { entry: 0, mid: 1, premium: 2, super_premium: 3 } as const;

export default function CatalogPage() {
  let catalog;
  try {
    catalog = loadCatalog();
  } catch (e) {
    const err = e instanceof CatalogError ? e : null;
    return (
      <Callout tone="rose">
        <b>The catalog could not be loaded.</b>
        <p className="mt-1">{err?.message ?? "Unknown error."}</p>
        {err?.details?.length ? (
          <ul className="mt-2 list-disc pl-5 font-mono-num text-[12px]">
            {err.details.slice(0, 20).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </Callout>
    );
  }

  const stale = new Set(staleCards(catalog).map((c) => c.card_id));
  const cards = [...catalog.cards].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name),
  );

  return (
    <div>
      <div className="mb-8">
        <p
          className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          {catalog.cards.length} cards · {catalog.categories.length} categories
        </p>
        <h1 className="mb-2 text-3xl leading-tight">The catalog</h1>
        <p className="max-w-3xl text-[15px]" style={{ color: "var(--ink-muted)" }}>
          Every card the engine reads, exactly as the YAML defines it. This is the page to check
          when a recommendation looks wrong — nine times out of ten the answer is here, not in the
          engine.
        </p>
      </div>

      {stale.size > 0 && (
        <div className="mb-6">
          <Callout tone="gold">
            <b>{stale.size} card{stale.size === 1 ? "" : "s"} past the staleness window</b> of{" "}
            {catalog.config.catalog_staleness_alert_days} days. Issuers devalue programs quietly —
            re-verify before trusting these.
          </Callout>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const best = [...c.redemption].sort((a, b) => b.inr_per_point - a.inr_per_point)[0];
          const baseRate = (c.base.points_per_unit / c.base.unit_inr) * best.inr_per_point * 100;
          return (
            <Link key={c.card_id} href={`/catalog/${c.card_id}`} className="no-underline">
              <Card className="h-full p-5 transition-shadow hover:shadow-md">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <Pill tone={c.status === "active" ? "teal" : "rose"}>{c.status}</Pill>
                  <Pill>{c.tier.replace("_", " ")}</Pill>
                  <Pill>{c.network.name}</Pill>
                  {stale.has(c.card_id) && <Pill tone="gold">stale</Pill>}
                </div>
                <h3 className="mb-0.5 text-lg" style={{ color: "var(--ink)" }}>
                  {c.name}
                </h3>
                <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                  {c.issuer}
                </p>
                <dl className="space-y-1 text-[12.5px]">
                  <Row k="Base rate">
                    {c.base.points_per_unit} pt / {formatInr(c.base.unit_inr)}{" "}
                    <span style={{ color: "var(--ink-faint)" }}>
                      (≈{baseRate.toFixed(2)}% at best redemption)
                    </span>
                  </Row>
                  <Row k="Annual fee">
                    {c.fee.annual === 0 ? "Free" : formatInr(c.fee.annual)}
                    {c.fee.waiver_threshold
                      ? ` · waived at ${formatLakh(c.fee.waiver_threshold)}`
                      : ""}
                  </Row>
                  <Row k="Accelerators">
                    {c.accelerators.length === 0
                      ? "None — base rate everywhere"
                      : c.accelerators.map((a) => `${a.multiplier}× ${a.scope.value}`).join(", ")}
                  </Row>
                  <Row k="Min income">
                    {Object.entries(c.gates.min_income)
                      .map(([k, v]) => `${k.replace("_", "-")} ${formatLakh(v as number)}`)
                      .join(" · ")}
                  </Row>
                </dl>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-10">
        <SectionLabel>Spend taxonomy</SectionLabel>
        <Card className="overflow-x-auto p-5">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Category", "MCC codes", "Confidence", "In form", "Usually excluded"].map((h) => (
                  <th
                    key={h}
                    className="border-b px-2 py-2 text-left font-mono-num text-[10px] font-medium uppercase tracking-[0.05em]"
                    style={{ borderColor: "var(--line-strong)", color: "var(--ink-faint)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.categories.map((cat) => (
                <tr key={cat.category_id}>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    <b>{cat.display_name}</b>
                    <div className="font-mono-num text-[10.5px]" style={{ color: "var(--ink-faint)" }}>
                      {cat.category_id}
                    </div>
                  </td>
                  <td
                    className="border-b px-2 py-2 font-mono-num text-[11px]"
                    style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}
                  >
                    {cat.mcc_codes?.join(" · ") ?? "—"}
                  </td>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    <Pill tone={cat.mapping_confidence === "low" ? "rose" : cat.mapping_confidence === "medium" ? "gold" : "teal"}>
                      {cat.mapping_confidence}
                    </Pill>
                  </td>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    {cat.is_selectable_in_form ? "yes" : "—"}
                  </td>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    {cat.commonly_excluded ? "yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0" style={{ color: "var(--ink-faint)" }}>
        {k}
      </dt>
      <dd className="m-0 min-w-0" style={{ color: "var(--ink-muted)" }}>
        {children}
      </dd>
    </div>
  );
}
