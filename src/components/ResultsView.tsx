"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { CardResult, RecommendationResult } from "@/engine/types";
import { formatInr, formatPoints } from "@/engine/format";
import {
  Card,
  Callout,
  Pill,
  SectionTitle,
  SectionLabel,
  Stat,
  Button,
  CardVisual,
  AnimatedNumber,
} from "./ui";
import { approvalOdds, type CreditScoreBucket } from "./creditScore";

const REVEAL = { type: "spring" as const, stiffness: 260, damping: 28 };

/** A plus that squashes into a minus — the accordion-toggle icon, animated
 * by scaling the vertical bar rather than crossfading two characters. */
function PlusMinus({ open }: { open: boolean }) {
  return (
    <span className="relative inline-block h-3 w-3 shrink-0" aria-hidden="true">
      <span
        className="absolute left-0 top-1/2 h-[1.5px] w-3 -translate-y-1/2"
        style={{ background: "var(--ink-faint)" }}
      />
      <motion.span
        className="absolute left-1/2 top-0 h-3 w-[1.5px] -translate-x-1/2"
        style={{ background: "var(--ink-faint)" }}
        animate={{ scaleY: open ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
      />
    </span>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  cashback: "Cashback",
  voucher: "Vouchers",
  portal: "Travel portal",
  airmiles: "Airline miles",
  merchandise: "Merchandise",
};

const FEATURED_COUNT = 3;
/** Total shown on screen is capped at FEATURED_COUNT + SECONDARY_COUNT (5) —
 * a recommendation engine's job is to decide, not hand over a spreadsheet.
 * Nothing beyond that is hidden forever: the eligible count above still
 * states the true total, and the gated-cards disclosure covers the rest. */
const SECONDARY_COUNT = 2;

export function ResultsView({
  result,
  creditScore = "unsure",
  onRestart,
}: {
  result: RecommendationResult;
  creditScore?: CreditScoreBucket;
  onRestart: () => void;
}) {
  const [showGated, setShowGated] = useState(false);
  const best = result.ranked[0];
  const featured = result.ranked.slice(0, FEATURED_COUNT);
  const rest = result.ranked.slice(FEATURED_COUNT, FEATURED_COUNT + SECONDARY_COUNT);
  const shown = featured.length + rest.length;
  const remaining = result.ranked.length - shown;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p
            className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
            style={{ color: "var(--teal)" }}
          >
            <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
            {result.ranked.length} card{result.ranked.length === 1 ? "" : "s"} you qualify for
            {remaining > 0 ? ` · showing your best ${shown}` : ""}
          </p>
          <h1 className="text-3xl leading-tight">
            {best ? `Your top ${Math.min(FEATURED_COUNT, result.ranked.length)} matches` : "No card matches yet"}
          </h1>
        </div>
        <Button variant="secondary" onClick={onRestart}>
          Start over
        </Button>
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

      <div className="space-y-5">
        {featured.map((r, i) => (
          <motion.div
            key={r.card.card_id}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...REVEAL, delay: i * 0.09 }}
          >
            <FeaturedResult result={r} isBest={i === 0} creditScore={creditScore} />
          </motion.div>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-8">
          <SectionLabel>Also worth a look</SectionLabel>
          <div className="space-y-2">
            {rest.map((r, i) => (
              <motion.div
                key={r.card.card_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...REVEAL, delay: FEATURED_COUNT * 0.09 + i * 0.05 }}
              >
                <SecondaryRow result={r} />
              </motion.div>
            ))}
          </div>
          {remaining > 0 && (
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
              {remaining} more card{remaining === 1 ? "" : "s"} you qualify for, ranked lower on
              money.{" "}
              <Link href="/catalog" style={{ color: "var(--teal)" }}>
                Compare the full catalog →
              </Link>
            </p>
          )}
        </div>
      )}

      {result.gated.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setShowGated((s) => !s)}
            className="text-[13px] font-medium"
            style={{ color: "var(--ink-muted)" }}
          >
            {showGated ? "Hide" : "Why aren't there more cards?"}{" "}
            <span style={{ color: "var(--teal)" }}>{showGated ? "" : "›"}</span>
          </button>
          {showGated && (
            <div className="mt-3 space-y-2">
              {result.gated.map((g) => (
                <div
                  key={g.card.card_id}
                  className="rounded-lg border px-4 py-3"
                  style={{ borderColor: "var(--line)", background: "var(--paper-sunken)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{g.card.name}</span>
                    <Pill tone="rose">not eligible</Pill>
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
          )}
        </div>
      )}

      <div
        className="mt-10 rounded-lg border px-4 py-3 text-[12px]"
        style={{ borderColor: "var(--line)", color: "var(--ink-faint)" }}
      >
        Based on {formatInr(result.meta.total_monthly_spend)} a month (
        {formatInr(result.meta.total_annual_spend)} a year) across {result.meta.cards_evaluated}{" "}
        cards we checked you against.
      </div>
    </div>
  );
}

function FeaturedResult({
  result,
  isBest,
  creditScore,
}: {
  result: CardResult;
  isBest: boolean;
  creditScore: CreditScoreBucket;
}) {
  const [open, setOpen] = useState(false);
  const v = result.valuation;
  if (!v) return null;
  const odds = approvalOdds(result.card.tier, creditScore);

  return (
    <Card className="overflow-hidden p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
        <CardVisual
          name={result.card.name}
          issuer={result.card.issuer}
          network={result.card.network.name}
          tier={result.card.tier}
          cardId={result.card.card_id}
        />
        <div className="flex flex-col justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {isBest ? (
                <Pill tone="teal">best match</Pill>
              ) : (
                <span className="font-mono-num text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  #{result.rank}
                </span>
              )}
              <Pill>{result.card.tier.replace("_", " ")}</Pill>
              {result.tiebreak_applied && <Pill tone="gold">close call</Pill>}
              {odds && <Pill tone={odds.tone}>{odds.label}</Pill>}
            </div>
            <h3 className="text-xl">{result.card.name}</h3>
            <p className="mb-2 text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              {result.card.issuer} · {result.card.network.name}
              {result.card.network.tier ? ` ${result.card.network.tier}` : ""}
            </p>
            <div className="font-mono-num text-3xl font-semibold">
              <AnimatedNumber value={v.nav_inr} format={formatInr} />
            </div>
            <div className="font-mono-num text-[11px]" style={{ color: "var(--ink-faint)" }}>
              estimated value / year
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Stat label="rewards/yr" value={formatInr(v.annual_rewards_inr)} tone="pos" />
            {v.milestone_value_inr > 0 && (
              <Stat label="milestones" value={formatInr(v.milestone_value_inr)} tone="pos" />
            )}
            {v.effective_fee_inr > 0 ? (
              <Stat label="annual fee" value={`−${formatInr(v.effective_fee_inr)}`} tone="neg" />
            ) : (
              <Stat label="annual fee" value="waived" />
            )}
            {v.forex_cost_inr > 0 && (
              <Stat label="forex charges" value={`−${formatInr(v.forex_cost_inr)}`} tone="neg" />
            )}
            <Stat label="points/mo" value={formatPoints(v.monthly_points)} />
          </div>
        </div>
      </div>

      {result.explanation && result.explanation.length > 0 && (
        <ul className="mt-6 space-y-1.5 border-t pt-5" style={{ borderColor: "var(--line)" }}>
          {result.explanation.map((line, i) => (
            <li key={i} className="flex gap-2 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              <span style={{ color: "var(--teal)" }}>·</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 text-[13px] font-medium"
          style={{ color: "var(--ink-muted)" }}
        >
          <PlusMinus open={open} />
          {open ? "Hide the full arithmetic" : "Show the full arithmetic"}
        </button>
        <Link href={`/catalog/${result.card.card_id}`} className="text-[13px]" style={{ color: "var(--teal)" }}>
          Full terms →
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <Breakdown result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function SecondaryRow({ result }: { result: CardResult }) {
  const [open, setOpen] = useState(false);
  const v = result.valuation;
  if (!v) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono-num text-[11px]" style={{ color: "var(--ink-faint)" }}>
            #{result.rank}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14.5px] font-semibold">{result.card.name}</div>
            <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
              {result.card.issuer} · {result.card.tier.replace("_", " ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono-num text-[15px] font-semibold">
              <AnimatedNumber value={v.nav_inr} format={formatInr} />
            </div>
            <div className="font-mono-num text-[10px]" style={{ color: "var(--ink-faint)" }}>
              / year
            </div>
          </div>
          <PlusMinus open={open} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t px-4 pb-4" style={{ borderColor: "var(--line)" }}>
              {result.explanation && result.explanation.length > 0 && (
                <ul className="space-y-1.5 pt-4">
                  {result.explanation.map((line, i) => (
                    <li key={i} className="flex gap-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>
                      <span style={{ color: "var(--teal)" }}>·</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/catalog/${result.card.card_id}`}
                className="mt-4 inline-block text-[13px]"
                style={{ color: "var(--teal)" }}
              >
                Full terms →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function Breakdown({ result }: { result: CardResult }) {
  const v = result.valuation;
  if (!v) return null;

  return (
    <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--line)" }}>
      <SectionTitle>Points earned, per category, per month</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Category", "Spend", "Rate", "Spend at this rate", "Over the cap", "Points"].map((h) => (
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
                      <Pill tone="rose">{c.excluded === "zero_earn" ? "no points" : "base rate only"}</Pill>
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
              <td className="px-2 py-1.5 font-mono-num font-semibold">{formatPoints(v.monthly_points)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <SectionTitle>Turning points into money</SectionTitle>
          <Line k="Redeemed as" val={CHANNEL_LABEL[v.channel] ?? v.channel} />
          <Line k="Value per point" val={`₹${v.inr_per_point.toFixed(2)}`} />
          {v.channel_was_fallback && (
            <p className="py-1.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
              This card doesn&rsquo;t offer your preferred option, so it&rsquo;s valued at its
              next-best redemption instead.
            </p>
          )}
          {v.friction_factor !== 1 && (
            <Line k="Redemption adjustment" val={`×${v.friction_factor.toFixed(2)}`} />
          )}
          <Line k="Monthly value" val={formatInr(v.monthly_value_inr)} />
          <Line k="Yearly value" val={formatInr(v.annual_rewards_inr)} strong />
        </div>
        <div>
          <SectionTitle>Where the final number comes from</SectionTitle>
          <Line k="Rewards" val={formatInr(v.annual_rewards_inr)} />
          <Line k="Milestones" val={formatInr(v.milestone_value_inr)} />
          <Line k="Total before fees" val={formatInr(v.gross_annual_inr)} />
          <Line
            k="Annual fee"
            val={v.effective_fee_inr > 0 ? `−${formatInr(v.effective_fee_inr)}` : "waived"}
            neg={v.effective_fee_inr > 0}
          />
          {v.forex_cost_inr > 0 && (
            <Line k="Foreign transaction fees" val={`−${formatInr(v.forex_cost_inr)}`} neg />
          )}
          <Line k="Net value per year" val={formatInr(v.nav_inr)} strong />
        </div>
      </div>

      {result.fit && (
        <div className="mt-5">
          <SectionTitle>Fit score (tiebreak only — never affects the value above)</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Stat label="category coverage" value={result.fit.category_coverage.toFixed(2)} />
            <Stat label="reward type" value={result.fit.reward_type_match.toFixed(2)} />
            <Stat label="merchants" value={result.fit.merchant_overlap.toFixed(2)} />
            <Stat label="total" value={result.fit.total.toFixed(2)} tone="pos" />
          </div>
        </div>
      )}
    </div>
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
          color: neg ? "var(--rose)" : "var(--ink)",
        }}
      >
        {val}
      </span>
    </div>
  );
}
