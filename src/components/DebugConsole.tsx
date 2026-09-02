"use client";

import { useState } from "react";
import type { Category, EngineConfig, RecommendationResult, UserProfile } from "@/engine/types";
import { formatInr } from "@/engine/format";
import { Card, Callout, Pill, SectionLabel } from "./ui";

const PRESETS: { name: string; note: string; profile: UserProfile }[] = [
  {
    name: "Mid-income salaried",
    note: "The default case. Dining + online heavy, ₹5,000 fee budget.",
    profile: {
      age: 30,
      employment: "salaried",
      annual_income_inr: 1200000,
      spend: [
        { category_id: "dining", monthly_inr: 8000 },
        { category_id: "online_shopping", monthly_inr: 12000 },
        { category_id: "travel_air", monthly_inr: 5000 },
      ],
      residual_monthly_inr: 15000,
      preferred_channel: "voucher",
      fee_comfort_inr: 5000,
      frequent_merchants: [],
    },
  },
  {
    name: "High earner, travel-led",
    note: "Unlocks the premium tier. Shows milestones and airmiles redemption.",
    profile: {
      age: 38,
      employment: "salaried",
      annual_income_inr: 4000000,
      spend: [
        { category_id: "travel_air", monthly_inr: 40000 },
        { category_id: "travel_hotel", monthly_inr: 25000 },
        { category_id: "dining", monthly_inr: 15000 },
      ],
      residual_monthly_inr: 20000,
      preferred_channel: "airmiles",
      fee_comfort_inr: 15000,
      frequent_merchants: ["makemytrip"],
    },
  },
  {
    name: "Student, no income",
    note: "The empty-state test. Almost everything gates out.",
    profile: {
      age: 20,
      employment: "student",
      annual_income_inr: 0,
      spend: [
        { category_id: "dining", monthly_inr: 3000 },
        { category_id: "entertainment", monthly_inr: 1500 },
        { category_id: "telecom", monthly_inr: 800 },
      ],
      residual_monthly_inr: 2000,
      preferred_channel: "cashback",
      fee_comfort_inr: 0,
      frequent_merchants: [],
    },
  },
  {
    name: "Cap-buster",
    note: "Spend far past every cap — exercises overflow and post_cap=0.",
    profile: {
      age: 35,
      employment: "self_employed",
      annual_income_inr: 2500000,
      spend: [
        { category_id: "online_shopping", monthly_inr: 90000 },
        { category_id: "dining", monthly_inr: 60000 },
        { category_id: "groceries", monthly_inr: 40000 },
      ],
      residual_monthly_inr: 10000,
      preferred_channel: "voucher",
      fee_comfort_inr: 10000,
      frequent_merchants: ["amazon", "swiggy"],
    },
  },
  {
    name: "Residual dominates",
    note: "Triggers the 'add a fourth category' warning.",
    profile: {
      age: 30,
      employment: "salaried",
      annual_income_inr: 900000,
      spend: [
        { category_id: "dining", monthly_inr: 3000 },
        { category_id: "telecom", monthly_inr: 1000 },
        { category_id: "utilities", monthly_inr: 2000 },
      ],
      residual_monthly_inr: 45000,
      preferred_channel: "cashback",
      fee_comfort_inr: 3000,
      frequent_merchants: [],
    },
  },
  {
    name: "Excluded-only spend",
    note: "Rent, fuel and wallet loads. Should earn near zero on every card.",
    profile: {
      age: 30,
      employment: "salaried",
      annual_income_inr: 1500000,
      spend: [
        { category_id: "rent", monthly_inr: 35000 },
        { category_id: "fuel", monthly_inr: 8000 },
        { category_id: "wallet_load", monthly_inr: 5000 },
      ],
      residual_monthly_inr: 0,
      preferred_channel: "cashback",
      fee_comfort_inr: 5000,
      frequent_merchants: [],
    },
  },
];

export function DebugConsole({
  categories,
  config,
  cardCount,
}: {
  categories: Category[];
  config: EngineConfig;
  cardCount: number;
}) {
  const [raw, setRaw] = useState(JSON.stringify(PRESETS[0].profile, null, 2));
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  async function run(payload?: UserProfile) {
    setLoading(true);
    setError(null);
    setResult(null);
    let body: unknown;
    if (payload) {
      body = payload;
      setRaw(JSON.stringify(payload, null, 2));
    } else {
      try {
        body = JSON.parse(raw);
      } catch (e) {
        setError(`Payload is not valid JSON: ${(e as Error).message}`);
        setLoading(false);
        return;
      }
    }
    const t0 = performance.now();
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setMs(Math.round(performance.now() - t0));
      if (!res.ok) {
        setError([json.error, ...(json.details ?? [])].filter(Boolean).join("\n"));
        return;
      }
      setResult(json as RecommendationResult);
    } catch {
      setError("Could not reach /api/recommend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p
          className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          {cardCount} cards · tiebreak band {config.tiebreak_band_pct}%
        </p>
        <h1 className="mb-2 text-3xl leading-tight">Engine debug console</h1>
        <p className="max-w-3xl text-[15px]" style={{ color: "var(--ink-muted)" }}>
          Post any profile straight at the engine and read the raw ranked output. This is how you
          validate the catalog once real card data goes in.
        </p>
      </div>

      <SectionLabel>Presets</SectionLabel>
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => run(p.profile)}
            className="rounded-lg border p-3 text-left transition-colors"
            style={{ borderColor: "var(--line-strong)", background: "var(--paper-raised)" }}
          >
            <div className="text-[13.5px] font-semibold">{p.name}</div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
              {p.note}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionLabel>Request payload — POST /api/recommend</SectionLabel>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            rows={22}
            className="w-full rounded-lg border p-3 font-mono-num text-[12px]"
            style={{
              background: "var(--paper-sunken)",
              borderColor: "var(--line)",
              color: "var(--ink)",
            }}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => run()}
              disabled={loading}
              className="rounded-lg px-5 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{ background: "var(--teal)", color: "var(--on-teal)" }}
            >
              {loading ? "Running…" : "Run engine"}
            </button>
            {ms !== null && (
              <span className="font-mono-num text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                {ms} ms round trip
              </span>
            )}
          </div>
          <details className="mt-4">
            <summary
              className="cursor-pointer font-mono-num text-[11px] uppercase tracking-[0.06em]"
              style={{ color: "var(--ink-faint)" }}
            >
              Valid category ids ({categories.length})
            </summary>
            <p className="mt-2 font-mono-num text-[11px]" style={{ color: "var(--ink-muted)" }}>
              {categories.map((c) => c.category_id).join(" · ")}
            </p>
          </details>
        </Card>

        <Card className="p-5">
          <SectionLabel>Engine output</SectionLabel>
          {error && (
            <Callout tone="rose">
              <pre className="m-0 whitespace-pre-wrap font-mono-num text-[12px]">{error}</pre>
            </Callout>
          )}
          {!error && !result && (
            <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
              Pick a preset or run the payload to see results.
            </p>
          )}
          {result && (
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <Pill tone="teal">{result.ranked.length} eligible</Pill>
                <Pill tone="rose">{result.gated.length} gated</Pill>
                {result.warnings.length > 0 && <Pill tone="gold">{result.warnings.length} warning</Pill>}
              </div>

              {result.warnings.map((w, i) => (
                <p key={i} className="mb-2 text-[12.5px]" style={{ color: "var(--gold)" }}>
                  ⚠ {w}
                </p>
              ))}

              <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["#", "Card", "NAV", "Fit", "Chan", "Pts/mo"].map((h) => (
                      <th
                        key={h}
                        className="border-b px-1.5 py-1.5 text-left font-mono-num text-[10px] font-medium uppercase"
                        style={{ borderColor: "var(--line-strong)", color: "var(--ink-faint)" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.ranked.map((r) => (
                    <tr key={r.card.card_id}>
                      <td className="border-b px-1.5 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                        {r.rank}
                      </td>
                      <td className="border-b px-1.5 py-1.5" style={{ borderColor: "var(--line)" }}>
                        {r.card.name}
                        {r.tiebreak_applied && (
                          <span className="ml-1">
                            <Pill tone="gold">tb</Pill>
                          </span>
                        )}
                      </td>
                      <td
                        className="border-b px-1.5 py-1.5 font-mono-num font-semibold"
                        style={{ borderColor: "var(--line)" }}
                      >
                        {formatInr(r.valuation!.nav_inr)}
                      </td>
                      <td className="border-b px-1.5 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                        {r.fit!.total.toFixed(2)}
                      </td>
                      <td className="border-b px-1.5 py-1.5 font-mono-num text-[10.5px]" style={{ borderColor: "var(--line)" }}>
                        {r.valuation!.channel.slice(0, 4)}
                        {r.valuation!.channel_was_fallback ? "*" : ""}
                      </td>
                      <td className="border-b px-1.5 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                        {Math.round(r.valuation!.monthly_points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {result.gated.length > 0 && (
                <div className="mt-4">
                  <SectionLabel>Gated</SectionLabel>
                  {result.gated.map((g) => (
                    <p key={g.card.card_id} className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
                      <b>{g.card.name}</b> —{" "}
                      {g.gate_failures.map((f) => `${f.code}: ${f.message}`).join(" · ")}
                    </p>
                  ))}
                </div>
              )}

              <details className="mt-4">
                <summary
                  className="cursor-pointer font-mono-num text-[11px] uppercase tracking-[0.06em]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  Raw JSON response
                </summary>
                <pre
                  className="mt-2 max-h-96 overflow-auto rounded-lg p-3 font-mono-num text-[10.5px]"
                  style={{ background: "var(--paper-sunken)" }}
                >
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card className="p-5">
          <SectionLabel>Active engine config</SectionLabel>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(config)
              .filter(([, v]) => typeof v !== "object")
              .map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-2 border-b py-1 font-mono-num text-[11.5px]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span style={{ color: "var(--ink-faint)" }}>{k}</span>
                  <span
                    style={{
                      color: v === false ? "var(--rose)" : v === true ? "var(--teal)" : "var(--ink)",
                    }}
                  >
                    {String(v)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
