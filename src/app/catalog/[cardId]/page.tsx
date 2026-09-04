import { notFound } from "next/navigation";
import { loadCatalog } from "@/catalog/load";
import { formatInr, formatLakh, formatPoints } from "@/engine/format";
import { Card, Callout, Pill, SectionTitle, CardVisual, BackButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  cashback: "Cashback",
  voucher: "Points",
  portal: "Airmiles",
  merchandise: "Merchandise",
};

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
      <p className="mb-4">
        <BackButton />
      </p>

      <div className="mb-8 grid gap-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:items-center">
        <CardVisual name={card.name} issuer={card.issuer} network={card.network.name} tier={card.tier} cardId={card.card_id} />
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Pill>{card.tier.replace("_", " ")}</Pill>
            <Pill>
              {card.network.name}
              {card.network.tier ? ` ${card.network.tier}` : ""}
            </Pill>
          </div>
          <h1 className="text-3xl leading-tight">{card.name}</h1>
          <p className="text-[14px]" style={{ color: "var(--ink-muted)" }}>
            {card.issuer}
          </p>
        </div>
      </div>

      {card.status !== "active" && (
        <div className="mb-6">
          <Callout tone="rose">
            This card is no longer available and won&rsquo;t appear in your results.
          </Callout>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Earning</SectionTitle>
          <KV k="Base rate" v={`${card.base.points_per_unit} ${card.base.currency} per ${formatInr(card.base.unit_inr)}`} />
          <KV k="Points expiry" v={card.points_expiry_months ? `${card.points_expiry_months} months` : "No expiry"} />
          {card.welcome?.points ? (
            <KV k="Welcome bonus" v={`${formatPoints(card.welcome.points)} points — ${card.welcome.condition ?? ""}`} />
          ) : null}
        </Card>

        <Card className="p-5">
          <SectionTitle>Cost</SectionTitle>
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
          <SectionTitle>Eligibility</SectionTitle>
          <KV k="Age" v={`${card.gates.min_age}${card.gates.max_age ? `–${card.gates.max_age}` : "+"}`} />
          <KV k="Employment" v={card.gates.allowed_employment.map((e) => e.replace("_", "-")).join(", ")} />
          {Object.entries(card.gates.min_income).map(([k, v]) => (
            <KV key={k} k={`Min income (${k.replace("_", "-")})`} v={formatLakh(v as number)} />
          ))}
        </Card>

        <Card className="p-5">
          <SectionTitle>Source & verification</SectionTitle>
          <KV k="Terms effective from" v={card.meta.effective_date ?? "—"} />
          <KV k="Last checked" v={card.meta.last_verified ?? "—"} />
          {card.meta.terms_url && (
            <KV k="Issuer terms" v={<span style={{ color: "var(--ink-faint)" }}>{card.meta.terms_url}</span>} />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <SectionTitle>Accelerators</SectionTitle>
          {card.accelerators.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              None — this card earns the base rate everywhere.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11.5px] sm:hidden" style={{ color: "var(--ink-faint)" }}>
                Swipe to see all columns →
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Category", "Rate", "How it stacks", "Spend cap", "Past the cap"].map((h) => (
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
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {catName(a.scope.value)}
                    </td>
                    <td className="border-b px-2 py-2 font-mono-num font-semibold" style={{ borderColor: "var(--line)" }}>
                      {a.multiplier}×
                    </td>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {a.basis === "additional" ? (
                        <Pill tone="gold">on top of base (= {a.multiplier + 1}× total)</Pill>
                      ) : (
                        "replaces base rate"
                      )}
                    </td>
                    <td className="border-b px-2 py-2 font-mono-num" style={{ borderColor: "var(--line)" }}>
                      {a.cap.type === "none"
                        ? "No cap"
                        : a.cap.type === "spend"
                          ? `${formatInr(a.cap.value!)} spend`
                          : `${formatPoints(a.cap.value!)} pts`}
                    </td>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {a.post_cap === 0 ? (
                        <Pill tone="rose">stops earning</Pill>
                      ) : (
                        <span style={{ color: "var(--ink-muted)" }}>reverts to base rate</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Redemption</SectionTitle>
          <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[...card.redemption]
                .sort((a, b) => b.inr_per_point - a.inr_per_point)
                .map((r) => (
                  <tr key={r.channel}>
                    <td className="border-b px-2 py-2" style={{ borderColor: "var(--line)" }}>
                      {CHANNEL_LABEL[r.channel] ?? r.channel}
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
          <SectionTitle>Exclusions</SectionTitle>
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
                  {e.treatment === "zero_earn" ? "no points earned" : "base rate only"}
                </span>
              </span>
            ))}
          </div>

          {card.milestones.length > 0 && (
            <>
              <div className="mt-5">
                <SectionTitle>Milestones</SectionTitle>
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
