import Link from "next/link";
import { loadCatalog } from "@/catalog/load";
import { formatInr, formatLakh } from "@/engine/format";
import { Card, Callout, Pill, CardVisual, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const TIER_ORDER = { entry: 0, mid: 1, premium: 2, super_premium: 3 } as const;

export default function CatalogPage() {
  let catalog;
  try {
    catalog = loadCatalog();
  } catch {
    return (
      <Callout tone="rose">
        We&rsquo;re having trouble loading card data right now. Please try again shortly.
      </Callout>
    );
  }

  const cards = [...catalog.cards]
    .filter((c) => c.status === "active")
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name));

  const categoryName = (id: string) =>
    catalog.categories.find((cat) => cat.category_id === id)?.display_name ?? id;

  return (
    <div>
      <div className="mb-8">
        <p
          className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          {cards.length} cards · {catalog.categories.length} spending categories
        </p>
        <h1 className="mb-2 text-3xl leading-tight">Compare cards</h1>
        <p className="max-w-3xl text-[15px]" style={{ color: "var(--ink-muted)" }}>
          Every card we track, with its rates, fees and eligibility rules laid out plainly. Tap a
          card for the full terms.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Card key={c.card_id} className="h-full overflow-hidden">
            <Link href={`/catalog/${c.card_id}`} className="block no-underline">
              <div className="p-4 pb-0">
                <CardVisual name={c.name} issuer={c.issuer} network={c.network.name} tier={c.tier} cardId={c.card_id} />
              </div>
              <div className="px-4 pt-3">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <Pill>{c.tier.replace("_", " ")}</Pill>
                </div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                  {c.name}
                </h3>
                <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
                  {c.issuer}
                </p>
              </div>
            </Link>
            <dl className="space-y-1.5 px-4 pb-4 pt-3 text-[12.5px]">
              <Row k="Base rate">
                {c.base.points_per_unit} pt / {formatInr(c.base.unit_inr)}
              </Row>
              <Row k="Annual fee">
                {c.fee.annual === 0 ? "Free" : formatInr(c.fee.annual)}
                {c.fee.waiver_threshold ? ` · waived at ${formatLakh(c.fee.waiver_threshold)}` : ""}
              </Row>
              <Row k="Bonus categories">
                {c.accelerators.length === 0
                  ? "None — base rate everywhere"
                  : c.accelerators
                      .map((a) => `${a.multiplier}× ${categoryName(a.scope.value)}`)
                      .join(", ")}
              </Row>
              <Row k="Min income">
                {Object.entries(c.gates.min_income)
                  .map(([k, v]) => `${k.replace("_", "-")} ${formatLakh(v as number)}`)
                  .join(" · ")}
              </Row>
            </dl>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <SectionTitle description="What each spending category covers, whether you can name it in the wizard, and whether it's typically left out of card rewards.">
          Spend taxonomy
        </SectionTitle>
        <Card className="overflow-x-auto p-5">
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Category", "Selectable when you apply", "Usually excluded from rewards"].map((h) => (
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
                  </td>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    {cat.is_selectable_in_form ? "Yes" : "—"}
                  </td>
                  <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                    {cat.commonly_excluded ? "Often" : "—"}
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
      <dt className="w-24 shrink-0 font-mono-num text-[10.5px] uppercase tracking-[0.05em]" style={{ color: "var(--ink-faint)" }}>
        {k}
      </dt>
      <dd className="m-0 min-w-0" style={{ color: "var(--ink-muted)" }}>
        {children}
      </dd>
    </div>
  );
}
