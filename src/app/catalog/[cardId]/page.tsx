import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCatalog } from "@/catalog/load";
import { formatInr, formatLakh, formatPoints } from "@/engine/format";
import { Card, Callout, Pill, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CardDetail({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;

  let catalog;
  try {
    catalog = loadCatalog();
  } catch {
    notFound();
  }

  const card = catalog.cards.find((c) => c.card_id === cardId);
  if (!card) notFound();

  const catName = (id: string) =>
    catalog.categories.find((c) => c.category_id === id)?.display_name ?? id;

  return (
    <div>
      <p className="mb-4 text-[13px]">
        <Link href="/catalog" style={{ color: "var(--teal)" }}>
          ← Back to catalog
        </Link>
      </p>

      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Pill tone={card.status === "active" ? "teal" : "rose"}>{card.status}</Pill>
          <Pill>{card.tier.replace("_", " ")}</Pill>
          <Pill>
            {card.network.name}
            {card.network.tier ? ` ${card.network.tier}` : ""}
          </Pill>
          <Pill tone={card.meta.confidence === "high" ? "teal" : "gold"}>
            data {card.meta.confidence}
          </Pill>
        </div>
        <h1 className="text-3xl leading-tight">{card.name}</h1>
        <p className="text-[14px]" style={{ color: "var(--ink-muted)" }}>
          {card.issuer}
        </p>
      </div>

      {card.status !== "active" && (
        <div className="mb-6">
          <Callout tone="rose">
            This card is <b>{card.status}</b> and is never returned by the engine. It stays in the
            catalog for history.
          </Callout>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Earning</SectionLabel>
          <KV k="Base rate" v={`${card.base.points_per_unit} ${card.base.currency} per ${formatInr(card.base.unit_inr)}`} />
          <KV k="Points expiry" v={card.points_expiry_months ? `${card.points_expiry_months} months` : "No expiry"} />
          {card.welcome?.points ? (
            <KV k="Welcome bonus" v={`${formatPoints(card.welcome.points)} points — ${card.welcome.condition ?? ""}`} />
          ) : null}
        </Card>

        <Card className="p-5">
          <SectionLabel>Cost</SectionLabel>
          <KV k="Annual fee" v={card.fee.annual === 0 ? "Free" : formatInr(card.fee.annual)} />
          <KV k="Joining fee" v={card.fee.joining ? formatInr(card.fee.joining) : "None"} />
          <KV
            k="Fee waiver"
            v={card.fee.waiver_threshold ? `At ${formatLakh(card.fee.waiver_threshold)} annual spend` : "No waiver"}
          />
          <KV k="GST on fee" v={`${card.fee.gst_pct}%`} />
          <KV k="Forex markup" v={`${card.forex_markup_pct}%`} />
        </Card>

        <Card className="p-5">
          <SectionLabel>Eligibility gates</SectionLabel>
          <KV k="Age" v={`${card.gates.min_age}${card.gates.max_age ? `–${card.gates.max_age}` : "+"}`} />
          <KV k="Employment" v={card.gates.allowed_employment.map((e) => e.replace("_", "-")).join(", ")} />
          {Object.entries(card.gates.min_income).map(([k, v]) => (
            <KV key={k} k={`Min income (${k.replace("_", "-")})`} v={formatLakh(v as number)} />
          ))}
        </Card>

        <Card className="p-5">
          <SectionLabel>Catalog metadata</SectionLabel>
          <KV k="Terms effective" v={card.meta.effective_date ?? "—"} />
          <KV k="Last verified" v={card.meta.last_verified ?? "never"} />
          <KV k="Owner" v={card.meta.owner ?? "unassigned"} />
          {card.meta.terms_url && (
            <KV k="Terms" v={<span style={{ color: "var(--ink-faint)" }}>{card.meta.terms_url}</span>} />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card className="overflow-x-auto p-5">
          <SectionLabel>Accelerators</SectionLabel>
          {card.accelerators.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              None — this card earns the base rate everywhere.
            </p>
          ) : (
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Rule", "Category", "Multiplier", "Basis", "Cap", "Past cap"].map((h) => (
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
                {card.accelerators.map((a) => (
                  <tr key={a.id}>
                    <td className="border-b px-2 py-2 font-mono-num text-[11px]" style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}>
                      {a.id}
                    </td>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {catName(a.scope.value)}
                    </td>
                    <td className="border-b px-2 py-2 font-mono-num font-semibold" style={{ borderColor: "var(--line)" }}>
                      {a.multiplier}×
                    </td>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {a.basis === "additional" ? (
                        <Pill tone="gold">additional (= {a.multiplier + 1}× total)</Pill>
                      ) : (
                        "total"
                      )}
                    </td>
                    <td className="border-b px-2 py-2 font-mono-num" style={{ borderColor: "var(--line)" }}>
                      {a.cap.type === "none"
                        ? "uncapped"
                        : a.cap.type === "spend"
                          ? `${formatInr(a.cap.value!)} spend`
                          : `${formatPoints(a.cap.value!)} pts`}
                    </td>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {a.post_cap === 0 ? (
                        <Pill tone="rose">stops earning</Pill>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>reverts to base</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Redemption</SectionLabel>
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[...card.redemption]
                .sort((a, b) => b.inr_per_point - a.inr_per_point)
                .map((r) => (
                  <tr key={r.channel}>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {r.channel}
                      {r.is_default && (
                        <span className="ml-1.5">
                          <Pill tone="teal">default</Pill>
                        </span>
                      )}
                      {r.transfer_ratio && (
                        <span className="ml-1.5 font-mono-num text-[10.5px]" style={{ color: "var(--ink-faint)" }}>
                          {r.transfer_ratio}
                        </span>
                      )}
                    </td>
                    <td
                      className="border-b px-2 py-2 text-right font-mono-num font-semibold"
                      style={{ borderColor: "var(--line)" }}
                    >
                      ₹{r.inr_per_point.toFixed(2)} / pt
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <SectionLabel>Exclusions</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {card.exclusions.length === 0 && (
              <span className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
                None declared.
              </span>
            )}
            {card.exclusions.map((e) => (
              <span
                key={e.category}
                className="rounded-lg px-2.5 py-1 text-[12.5px]"
                style={{
                  background: e.treatment === "zero_earn" ? "var(--rose-soft)" : "var(--gold-soft)",
                  color: "var(--ink)",
                }}
              >
                {catName(e.category)}
                <span className="ml-1.5 font-mono-num text-[10px]" style={{ opacity: 0.7 }}>
                  {e.treatment.replace("_", " ")}
                </span>
              </span>
            ))}
          </div>

          {card.milestones.length > 0 && (
            <>
              <div className="mt-5">
                <SectionLabel>Milestones</SectionLabel>
              </div>
              {card.milestones.map((m) => (
                <KV
                  key={m.id}
                  k={formatLakh(m.threshold)}
                  v={`${formatInr(m.value_inr)} ${m.reward_type}${m.cumulative ? " (cumulative)" : ""}`}
                />
              ))}
            </>
          )}
        </Card>
      </div>

      {card.notes && (
        <p className="mt-6 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          {card.notes}
        </p>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      className="flex justify-between gap-4 border-b py-1.5 text-[12.5px]"
      style={{ borderColor: "var(--line)" }}
    >
      <span style={{ color: "var(--ink-faint)" }}>{k}</span>
      <span className="text-right" style={{ color: "var(--ink)" }}>
        {v}
      </span>
    </div>
  );
}
