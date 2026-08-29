"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  Category,
  Merchant,
  RecommendationResult,
  RedemptionChannel,
  EmploymentType,
  UserProfile,
} from "@/engine/types";
import { formatInr, formatLakh } from "@/engine/format";
import { ResultsView } from "./ResultsView";
import { Card, Callout, Pill, SectionLabel } from "./ui";

const CHANNELS: { id: RedemptionChannel; label: string; hint: string }[] = [
  { id: "cashback", label: "Cashback", hint: "Statement credit, automatic" },
  { id: "voucher", label: "Vouchers", hint: "Gift cards and brand vouchers" },
  { id: "portal", label: "Travel portal", hint: "Book through the issuer" },
  { id: "airmiles", label: "Airline miles", hint: "Transfer to airline partners" },
];

const EMPLOYMENTS: { id: EmploymentType; label: string }[] = [
  { id: "salaried", label: "Salaried" },
  { id: "self_employed", label: "Self-employed" },
  { id: "student", label: "Student" },
];

const STEPS = ["Your spending", "About you", "Preferences"] as const;

type SlotState = { category_id: string; monthly_inr: number };

export function RecommendFlow({
  categories,
  merchants,
}: {
  categories: Category[];
  merchants: Merchant[];
}) {
  const [step, setStep] = useState(0);

  const [slots, setSlots] = useState<SlotState[]>([
    { category_id: "dining", monthly_inr: 8000 },
    { category_id: "online_shopping", monthly_inr: 12000 },
    { category_id: "travel_air", monthly_inr: 5000 },
  ]);
  const [residual, setResidual] = useState(15000);
  const [age, setAge] = useState(30);
  const [employment, setEmployment] = useState<EmploymentType>("salaried");
  const [income, setIncome] = useState(1200000);
  const [channel, setChannel] = useState<RedemptionChannel>("voucher");
  const [feeComfort, setFeeComfort] = useState(5000);
  const [pickedMerchants, setPickedMerchants] = useState<string[]>([]);

  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthlyTotal = slots.reduce((s, x) => s + x.monthly_inr, 0) + residual;
  const largestNamed = slots.reduce((m, s) => Math.max(m, s.monthly_inr), 0);
  const residualDominates = residual > largestNamed && residual > 0;

  const duplicateCategory = useMemo(() => {
    const ids = slots.map((s) => s.category_id);
    return ids.length !== new Set(ids).size;
  }, [slots]);

  function setSlot(i: number, patch: Partial<SlotState>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    const used = new Set(slots.map((s) => s.category_id));
    const next = categories.find((c) => !used.has(c.category_id));
    if (next) setSlots((prev) => [...prev, { category_id: next.category_id, monthly_inr: 5000 }]);
  }

  function removeSlot(i: number) {
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    setResult(null);
    const profile: UserProfile = {
      age,
      employment,
      annual_income_inr: income,
      spend: slots.filter((s) => s.monthly_inr > 0),
      residual_monthly_inr: residual,
      preferred_channel: channel,
      fee_comfort_inr: feeComfort,
      frequent_merchants: pickedMerchants,
    };
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          [json.error, ...(json.details ?? [])].filter(Boolean).join(" · ") ||
            "Something went wrong.",
        );
        return;
      }
      setResult(json as RecommendationResult);
      setStep(3);
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    } catch {
      setError("Could not reach the engine. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  if (step === 3 && result) {
    return (
      <ResultsView
        result={result}
        onRestart={() => {
          setResult(null);
          setStep(0);
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p
          className="mb-2 flex items-center gap-2 font-mono-num text-[11px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          Step {step + 1} of 3
        </p>
        <h1 className="text-3xl leading-tight">{STEPS[step]}</h1>
      </div>

      {/* progress */}
      <div className="mb-8 flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? "var(--teal)" : "var(--line)" }}
          />
        ))}
      </div>

      {/* ── STEP 1 ── */}
      {step === 0 && (
        <div className="space-y-4">
          <Card className="p-6">
            <SectionLabel>Your biggest spend categories</SectionLabel>
            <p className="mb-5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              Name your top three and roughly what you spend per month. The rupee amounts are what
              drive the ranking — there is no separate weighting on top of them.
            </p>

            <div className="space-y-4">
              {slots.map((slot, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono-num text-[11px] font-semibold"
                    style={{ background: "var(--teal-soft)", color: "var(--teal)" }}
                  >
                    {i + 1}
                  </span>
                  <select
                    aria-label={`Category ${i + 1}`}
                    value={slot.category_id}
                    onChange={(e) => setSlot(i, { category_id: e.target.value })}
                    className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-[13.5px]"
                    style={{
                      background: "var(--paper-raised)",
                      borderColor: "var(--line-strong)",
                      color: "var(--ink)",
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    <input
                      type="range"
                      aria-label={`Monthly spend for category ${i + 1}`}
                      min={0}
                      max={100000}
                      step={1000}
                      value={slot.monthly_inr}
                      onChange={(e) => setSlot(i, { monthly_inr: Number(e.target.value) })}
                    />
                    <span className="w-20 shrink-0 text-right font-mono-num text-[13px]">
                      {formatInr(slot.monthly_inr)}
                    </span>
                  </div>
                  {slots.length > 1 && (
                    <button
                      onClick={() => removeSlot(i)}
                      aria-label={`Remove category ${i + 1}`}
                      className="rounded px-2 py-1 text-[12px]"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {slots.length < 6 && (
              <button
                onClick={addSlot}
                className="mt-4 rounded-lg border px-3 py-1.5 text-[13px]"
                style={{ borderColor: "var(--line-strong)", color: "var(--ink-muted)" }}
              >
                + Add another category
              </button>
            )}

            {duplicateCategory && (
              <div className="mt-4">
                <Callout tone="rose">
                  <b>The same category is selected twice.</b> Each slot needs a different category,
                  or its spend will be counted more than once.
                </Callout>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <SectionLabel>Everything else</SectionLabel>
            <p className="mb-4 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              All your other card spend in a month. This is mandatory — fee waivers and spend
              milestones are calculated on your total, not just the named categories.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                aria-label="Residual monthly spend"
                min={0}
                max={200000}
                step={1000}
                value={residual}
                onChange={(e) => setResidual(Number(e.target.value))}
              />
              <span className="w-24 shrink-0 text-right font-mono-num text-[15px] font-semibold">
                {formatInr(residual)}
              </span>
            </div>
            {residualDominates && (
              <div className="mt-4">
                <Callout tone="gold">
                  <b>Your &lsquo;everything else&rsquo; is bigger than any category you named.</b>{" "}
                  That usually means your real top three are different. Adding another category
                  above will make this noticeably more accurate.
                </Callout>
              </div>
            )}
            <p className="mt-5 border-t pt-4 text-[13px]" style={{ borderColor: "var(--line)" }}>
              Total monthly spend{" "}
              <b className="font-mono-num">{formatInr(monthlyTotal)}</b>{" "}
              <span style={{ color: "var(--ink-faint)" }}>
                · {formatLakh(monthlyTotal * 12)} a year
              </span>
            </p>
          </Card>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="p-6">
            <SectionLabel>Eligibility</SectionLabel>
            <p className="mb-5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              Issuers set minimum age and income by employment type. These decide which cards you
              can actually be approved for.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block font-mono-num text-[10.5px] uppercase tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                  Age · <b style={{ color: "var(--ink)" }}>{age}</b>
                </label>
                <input
                  type="range"
                  min={16}
                  max={80}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-2 block font-mono-num text-[10.5px] uppercase tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                  Annual income · <b style={{ color: "var(--ink)" }}>{formatLakh(income)}</b>
                </label>
                <input
                  type="range"
                  min={0}
                  max={6000000}
                  step={100000}
                  value={income}
                  onChange={(e) => setIncome(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block font-mono-num text-[10.5px] uppercase tracking-[0.06em]" style={{ color: "var(--ink-faint)" }}>
                Employment
              </label>
              <div className="flex flex-wrap gap-2">
                {EMPLOYMENTS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEmployment(e.id)}
                    aria-pressed={employment === e.id}
                    className="rounded-full border px-4 py-2 text-[13px] transition-colors"
                    style={
                      employment === e.id
                        ? { background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)" }
                        : { borderColor: "var(--line-strong)", color: "var(--ink-muted)" }
                    }
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Callout tone="teal">
            <b>No credit score is collected in v1.</b> That keeps the form short, but it means a
            recommended card can still be declined at application. See the README for the
            documented trade-off.
          </Callout>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card className="p-6">
            <SectionLabel>How do you want to be rewarded?</SectionLabel>
            <p className="mb-5 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              This picks which redemption rate each card is valued at — the same pile of points can
              be worth three times as much through one exit as another.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  aria-pressed={channel === c.id}
                  className="rounded-lg border px-4 py-3 text-left transition-colors"
                  style={
                    channel === c.id
                      ? { borderColor: "var(--teal)", background: "var(--teal-soft)" }
                      : { borderColor: "var(--line-strong)" }
                  }
                >
                  <div className="text-[14px] font-semibold">{c.label}</div>
                  <div className="text-[12px]" style={{ color: "var(--ink-muted)" }}>
                    {c.hint}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel>Annual fee budget</SectionLabel>
            <p className="mb-4 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              A hard filter: any card whose sticker fee is above this is removed, even if the fee
              would be waived at your spend level.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                aria-label="Annual fee budget"
                min={0}
                max={60000}
                step={250}
                value={feeComfort}
                onChange={(e) => setFeeComfort(Number(e.target.value))}
              />
              <span className="w-24 shrink-0 text-right font-mono-num text-[15px] font-semibold">
                {formatInr(feeComfort)}
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <SectionLabel>
              Merchants you use often <span style={{ textTransform: "none" }}>(optional)</span>
            </SectionLabel>
            <p className="mb-4 text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
              Used only to break ties between cards that are close on money. Never changes the
              value calculation itself.
            </p>
            <div className="flex flex-wrap gap-2">
              {merchants.map((m) => {
                const on = pickedMerchants.includes(m.merchant_id);
                return (
                  <button
                    key={m.merchant_id}
                    onClick={() =>
                      setPickedMerchants((prev) =>
                        on ? prev.filter((x) => x !== m.merchant_id) : [...prev, m.merchant_id],
                      )
                    }
                    aria-pressed={on}
                    className="flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors"
                    style={
                      on
                        ? { borderColor: "var(--teal)", background: "var(--teal-soft)", color: "var(--ink)" }
                        : { borderColor: "var(--line-strong)", color: "var(--ink-muted)" }
                    }
                  >
                    {m.display_name}
                    {m.has_cobrand_card && <Pill tone="gold">co-brand</Pill>}
                  </button>
                );
              })}
            </div>
          </Card>

          {error && <Callout tone="rose">{error}</Callout>}
        </div>
      )}

      {/* nav */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg border px-5 py-2.5 text-[13.5px] disabled:opacity-35"
          style={{ borderColor: "var(--line-strong)", color: "var(--ink-muted)" }}
        >
          Back
        </button>

        {step < 2 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={duplicateCategory}
            className="rounded-lg px-6 py-2.5 text-[13.5px] font-semibold disabled:opacity-40"
            style={{ background: "var(--ink)", color: "var(--paper)" }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-lg px-6 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
            style={{ background: "var(--teal)", color: "#fff" }}
          >
            {loading ? "Calculating…" : "Find my card"}
          </button>
        )}
      </div>

      <p className="mt-6 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        Want to see the raw engine output instead?{" "}
        <Link href="/debug" style={{ color: "var(--teal)" }}>
          Open the debug view
        </Link>
        .
      </p>
    </div>
  );
}
