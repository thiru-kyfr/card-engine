"use client";

import { useState } from "react";
import Link from "next/link";
import type { CardResult, RecommendationResult } from "@/engine/types";
import { formatInr, formatPoints } from "@/engine/format";
import { Card, Callout, Pill, SectionLabel, Stat } from "./ui";

export function ResultsView({
  result,
  onRestart,
}: {
  result: RecommendationResult;
  onRestart: () => void;
}) {
  const best = result.ranked[0];
  const maxNav = result.ranked.reduce((m, r) => Math.max(m, r.valuation?.nav_inr ?? 0), 0);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
            style={{ color: "var(--teal)" }}
          >
            <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
            {result.ranked.length} eligible · {result.gated.length} filtered out
          </p>
          <h1 className="text-3xl leading-tight">
            {best ? `${best.card.name} is your best match` : "No card matches yet"}
          </h1>
        </div>
        <button
          onClick={onRestart}
          className="rounded-lg border px-4 py-2 text-[13px]"
          style={{ borderColor: "var(--line-strong)", color: "var(--ink-muted)" }}
        >
          Start over
        </button>
      </div>

      {result.warnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {result.warnings.map((w, i) => (
            <Callout key={i} tone="gold">
              {w}
            </Callout>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {result.ranked.map((r, i) => (
          <ResultCard key={r.card.card_id} result={r} isBest={i === 0} maxNav={maxNav} />
        ))}
      </div>

      {result.gated.length > 0 && (
        <div className="mt-10">
          <SectionLabel>Filtered out — and why</SectionLabel>
          <div className="space-y-2">
            {result.gated.map((g) => (
              <div
                key={g.card.card_id}
                className="rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--line)", background: "var(--paper-sunken)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{g.card.name}</span>
                  <Pill tone="rose">removed</Pill>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {g.gate_failures.map((f, i) => (
                    <li key={i} className="text-[12.5px]" style={{ color: "var(--rose)" }}>
                      {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="mt-10 rounded-lg border px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}
      >
        Evaluated {result.meta.cards_evaluated} cards against{" "}
        {formatInr(result.meta.total_monthly_spend)}/month ({formatInr(result.meta.total_annual_spend)}{" "}
        a year). Cards within {result.meta.tiebreak_band_pct}% of each other on value are ordered by
        how well they fit your categories.
      </div>
    </div>
  );
}

function ResultCard({
  result,
  isBest,
  maxNav,
}: {
  result: CardResult;
  isBest: boolean;
  maxNav: number;
}) {
  const [open, setOpen] = useState(isBest);
  const v = result.valuation;
  if (!v) return null;
  const pct = maxNav > 0 ? Math.max(2, (Math.max(v.nav_inr, 0) / maxNav) * 100) : 2;

  return (
    <Card accent={isBest ? "teal" : undefined} className="overflow-hidden">
      <div
        className="p-5"
        style={isBest ? { background: "var(--teal-soft)" } : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {isBest && <Pill tone="teal">best match</Pill>}
              {!isBest && (
                <span className="font-mono-num text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  #{result.rank}
                </span>
              )}
              {result.tiebreak_applied && <Pill tone="gold">tiebreak</Pill>}
              <Pill>{result.card.tier.replace("_", " ")}</Pill>
            </div>
            <h3 className="text-xl">{result.card.name}</h3>
            <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              {result.card.issuer} · {result.card.network.name}
              {result.card.network.tier ? ` ${result.card.network.tier}` : ""}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono-num text-2xl font-semibold">{formatInr(v.nav_inr)}</div>
            <div className="font-mono-num text-[10.5px]" style={{ color: "var(--ink-faint)" }}>
              net value / year
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--paper-sunken)" }}>
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${pct}%`, background: "var(--teal)" }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="rewards" value={formatInr(v.annual_rewards_inr)} tone="pos" />
          {v.milestone_value_inr > 0 && (
            <Stat label="milestones" value={formatInr(v.milestone_value_inr)} tone="pos" />
          )}
          {v.effective_fee_inr > 0 ? (
            <Stat label="fee" value={`−${formatInr(v.effective_fee_inr)}`} tone="neg" />
          ) : (
            <Stat label="fee" value="waived" />
          )}
          {v.forex_cost_inr > 0 && (
            <Stat label="forex" value={`−${formatInr(v.forex_cost_inr)}`} tone="neg" />
          )}
          <Stat label="pts/mo" value={formatPoints(v.monthly_points)} />
        </div>
      </div>

      {result.explanation && result.explanation.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <ul className="space-y-1.5">
            {result.explanation.map((line, i) => (
              <li key={i} className="flex gap-2 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
                <span style={{ color: "var(--teal)" }}>·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t" style={{ borderColor: "var(--line)" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full px-5 py-2.5 text-left font-mono-num text-[11px] uppercase tracking-[0.07em]"
          style={{ color: "var(--ink-faint)" }}
        >
          {open ? "− Hide" : "+ Show"} the full arithmetic
        </button>
      </div>

      {open && (
        <div className="border-t px-5 py-4" style={{ borderColor: "var(--line)" }}>
          <SectionLabel>Points earned, per category, per month</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Category", "Spend", "Rate", "Qualifying", "Past cap", "Points"].map((h) => (
                    <th
                      key={h}
                      className="border-b px-2 py-1.5 text-left font-mono-num text-[10px] uppercase tracking-[0.05em] font-medium"
                      style={{ borderColor: "var(--line-strong)", color: "var(--ink-faint)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.categories.map((c) => (
                  <tr key={c.category_id}>
                    <td className="border-b px-2 py-1.5" style={{ borderColor: "var(--line)" }}>
                      {c.display_name}
                      {c.excluded && (
                        <span className="ml-1.5">
                          <Pill tone="rose">{c.excluded.replace("_", " ")}</Pill>
                        </span>
                      )}
                    </td>
                    <td className="border-b px-2 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                      {formatInr(c.monthly_spend)}
                    </td>
                    <td className="border-b px-2 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                      {c.effective_multiplier}×
                    </td>
                    <td className="border-b px-2 py-1.5 font-mono-num" style={{ borderColor: "var(--line)" }}>
                      {c.effective_multiplier > 1 ? formatInr(c.eligible_spend) : "—"}
                    </td>
                    <td
                      className="border-b px-2 py-1.5 font-mono-num"
                      style={{ borderColor: "var(--line)", color: c.cap_hit ? "var(--rose)" : undefined }}
                    >
                      {c.cap_hit ? formatInr(c.overflow_spend) : "—"}
                    </td>
                    <td className="border-b px-2 py-1.5 font-mono-num font-semibold" style={{ borderColor: "var(--line)" }}>
                      {formatPoints(c.monthly_points)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right font-semibold">
                    Monthly points
                  </td>
                  <td className="px-2 py-1.5 font-mono-num font-semibold">
                    {formatPoints(v.monthly_points)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <SectionLabel>Points to rupees</SectionLabel>
              <Line k="Channel used" val={v.channel + (v.channel_was_fallback ? " (fallback)" : "")} />
              <Line k="Rate" val={`₹${v.inr_per_point.toFixed(2)} / point`} />
              {v.friction_factor !== 1 && (
                <Line k="Realization" val={`×${v.friction_factor.toFixed(2)}`} />
              )}
              <Line k="Per month" val={formatInr(v.monthly_value_inr)} />
              <Line k="Per year" val={formatInr(v.annual_rewards_inr)} strong />
            </div>
            <div>
              <SectionLabel>Net annual value</SectionLabel>
              <Line k="Rewards" val={formatInr(v.annual_rewards_inr)} />
              <Line k="Milestones" val={formatInr(v.milestone_value_inr)} />
              <Line k="Gross" val={formatInr(v.gross_annual_inr)} />
              <Line
                k="Annual fee"
                val={v.effective_fee_inr > 0 ? `−${formatInr(v.effective_fee_inr)}` : "waived"}
                neg={v.effective_fee_inr > 0}
              />
              {v.forex_cost_inr > 0 && (
                <Line k="Forex markup" val={`−${formatInr(v.forex_cost_inr)}`} neg />
              )}
              <Line k="NAV" val={formatInr(v.nav_inr)} strong />
            </div>
          </div>

          {result.fit && (
            <div className="mt-5">
              <SectionLabel>Fit score (tiebreak only — never affects the value above)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <Stat label="category coverage" value={result.fit.category_coverage.toFixed(2)} />
                <Stat label="reward type" value={result.fit.reward_type_match.toFixed(2)} />
                <Stat label="merchants" value={result.fit.merchant_overlap.toFixed(2)} />
                <Stat label="total" value={result.fit.total.toFixed(2)} tone="pos" />
              </div>
            </div>
          )}

          <p className="mt-5">
            <Link
              href={`/catalog/${result.card.card_id}`}
              className="text-[13px]"
              style={{ color: "var(--teal)" }}
            >
              See this card&rsquo;s full terms →
            </Link>
          </p>
        </div>
      )}
    </Card>
  );
}

function Line({ k, val, strong, neg }: { k: string; val: string; strong?: boolean; neg?: boolean }) {
  return (
    <div
      className="flex justify-between border-b py-1.5 text-[12.5px]"
      style={{ borderColor: "var(--line)" }}
    >
      <span style={{ color: "var(--ink-muted)" }}>{k}</span>
      <span
        className="font-mono-num"
        style={{
          fontWeight: strong ? 600 : 400,
          color: neg ? "var(--rose)" : strong ? "var(--ink)" : "var(--ink)",
        }}
      >
        {val}
      </span>
    </div>
  );
}
