"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { CREDIT_SCORE_OPTIONS, type CreditScoreBucket } from "./creditScore";
import {
  Card,
  Callout,
  SectionTitle,
  FieldLabel,
  Button,
  Chip,
  IconTile,
  Stepper,
  AmountPicker,
  StepProgress,
  Pill,
  AnimatedNumber,
  PremiumSlider,
  CategoryPicker,
  ScoreGauge,
} from "./ui";

const STEP_TRANSITION = { type: "spring" as const, stiffness: 300, damping: 32 };
const SCORE_ORDER = ["building", "fair", "good", "excellent", "unsure"];

const CATEGORY_ICON: Record<string, string> = {
  dining: "🍽️",
  groceries: "🛒",
  online_shopping: "🛍️",
  travel_air: "✈️",
  travel_hotel: "🏨",
  cabs_transit: "🚕",
  entertainment: "🎬",
  apparel: "👗",
  electronics: "💻",
  departmental: "🏬",
  utilities: "💡",
  telecom: "📱",
  healthcare: "💊",
  education: "🎓",
  international: "🌍",
};
const CATEGORY_ICON_FALLBACK = "💳";

const CHANNELS: { id: RedemptionChannel; label: string; hint: string; icon: string }[] = [
  { id: "cashback", label: "Cashback", hint: "Statement credit, automatic", icon: "💰" },
  { id: "voucher", label: "Vouchers", hint: "Gift cards and brand vouchers", icon: "🎁" },
  { id: "portal", label: "Travel portal", hint: "Book through the issuer", icon: "🧳" },
  { id: "airmiles", label: "Airline miles", hint: "Transfer to airline partners", icon: "🛫" },
];

const EMPLOYMENTS: { id: EmploymentType; label: string; hint: string; icon: string }[] = [
  { id: "salaried", label: "Salaried", hint: "A regular monthly paycheck", icon: "💼" },
  { id: "self_employed", label: "Self-employed", hint: "Freelance, business or practice", icon: "🧑‍💻" },
  { id: "student", label: "Student", hint: "Still studying", icon: "🎓" },
];

const MONTHLY_INCOME_PRESETS = [
  { label: "Under ₹25K", value: 20000 },
  { label: "₹25–50K", value: 37500 },
  { label: "₹50K–1L", value: 75000 },
  { label: "₹1–2L", value: 150000 },
  { label: "₹2L+", value: 250000 },
];

const SPEND_PRESETS = [
  { label: "₹2K", value: 2000 },
  { label: "₹5K", value: 5000 },
  { label: "₹10K", value: 10000 },
  { label: "₹20K", value: 20000 },
  { label: "₹40K", value: 40000 },
];

const RESIDUAL_PRESETS = [
  { label: "₹5K", value: 5000 },
  { label: "₹15K", value: 15000 },
  { label: "₹30K", value: 30000 },
  { label: "₹50K", value: 50000 },
  { label: "₹1L", value: 100000 },
];

const FEE_PRESETS = [
  { label: "Free only", value: 0 },
  { label: "Up to ₹1K", value: 1000 },
  { label: "Up to ₹5K", value: 5000 },
  { label: "Up to ₹15K", value: 15000 },
  { label: "No limit", value: 60000 },
];

const STEPS = ["About you", "Your spending", "Preferences"] as const;
const SPENDING_STEP = 1;

type SlotState = { category_id: string; monthly_inr: number };

export function RecommendFlow({
  categories,
  merchants,
}: {
  categories: Category[];
  merchants: Merchant[];
}) {
  const [step, setStep] = useState(0);

  const [age, setAge] = useState(30);
  const [employment, setEmployment] = useState<EmploymentType>("salaried");
  const [monthlyIncome, setMonthlyIncome] = useState(100000);
  const [creditScore, setCreditScore] = useState<CreditScoreBucket>("unsure");

  const [slots, setSlots] = useState<SlotState[]>([
    { category_id: "dining", monthly_inr: 8000 },
    { category_id: "online_shopping", monthly_inr: 12000 },
    { category_id: "travel_air", monthly_inr: 5000 },
  ]);
  const [residual, setResidual] = useState(15000);

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
      annual_income_inr: monthlyIncome * 12,
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
      setError("We couldn't reach our servers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 3 && result) {
    return (
      <ResultsView
        result={result}
        creditScore={creditScore}
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
        <AnimatePresence mode="wait">
          <motion.h1
            key={step}
            className="text-3xl leading-tight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={STEP_TRANSITION}
          >
            {STEPS[step]}
          </motion.h1>
        </AnimatePresence>
      </div>

      <StepProgress steps={STEPS} current={step} />

      <AnimatePresence mode="wait">
      {/* ── STEP 1 — About you ── */}
      {step === 0 && (
        <motion.div
          key="step-0"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={STEP_TRANSITION}
          className="space-y-4">
          <Card className="p-6">
            <SectionTitle description="This decides which cards you're even eligible to apply for — nothing more, nothing hidden.">
              A little about you
            </SectionTitle>

            <FieldLabel>Employment</FieldLabel>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {EMPLOYMENTS.map((e) => (
                <IconTile
                  key={e.id}
                  icon={e.icon}
                  label={e.label}
                  hint={e.hint}
                  selected={employment === e.id}
                  onClick={() => setEmployment(e.id)}
                />
              ))}
            </div>

            <div className="mt-6">
              <Stepper label="Age" value={age} onChange={setAge} min={16} max={80} suffix="yrs" />
              <div className="mt-3">
                <PremiumSlider ariaLabel="Age slider" min={16} max={80} step={1} value={age} onChange={setAge} />
              </div>
            </div>

            <div className="mt-6">
              <FieldLabel>Monthly income</FieldLabel>

              <div className="mt-2 flex flex-wrap gap-2">
                {MONTHLY_INCOME_PRESETS.map((p) => (
                  <Chip
                    key={p.label}
                    selected={monthlyIncome === p.value}
                    onClick={() => setMonthlyIncome(p.value)}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-mono-num text-[34px] font-semibold leading-none" style={{ color: "var(--ink)" }}>
                  <AnimatedNumber value={monthlyIncome} format={(n) => formatInr(Math.round(n / 500) * 500)} />
                </span>
                <span className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
                  / month
                </span>
              </div>
              <div className="mt-3">
                <PremiumSlider
                  ariaLabel="Monthly income slider"
                  min={0}
                  max={500000}
                  step={5000}
                  value={monthlyIncome}
                  onChange={setMonthlyIncome}
                />
              </div>
              <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
                ≈ {formatLakh(monthlyIncome * 12)} a year
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle description="This never filters out a card — it only shows how likely you are to be approved for each match. Skip it if you don't know.">
              Your credit score <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>
            </SectionTitle>
            <ScoreGauge
              options={CREDIT_SCORE_OPTIONS}
              order={SCORE_ORDER}
              value={creditScore}
              onChange={(id) => setCreditScore(id as CreditScoreBucket)}
            />
          </Card>

          <Callout tone="teal">
            <b>This is a self-estimate, not a bureau check.</b> Approval always comes down to the
            issuer&rsquo;s own assessment, so a recommended card can still be declined at
            application.
          </Callout>
        </motion.div>
      )}

      {/* ── STEP 2 — Your spending ── */}
      {step === 1 && (
        <motion.div
          key="step-1"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={STEP_TRANSITION}
          className="space-y-4"
        >
          <Card className="p-6">
            <SectionTitle description="Name your top three and roughly what you spend per month. These amounts are what drive the ranking — there is no separate weighting on top of them.">
              Your biggest spend categories
            </SectionTitle>

            <div className="space-y-6">
              {slots.map((slot, i) => (
                <div key={i}>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono-num text-[11px] font-semibold"
                      style={{ background: "var(--teal-soft)", color: "var(--teal)" }}
                    >
                      {i + 1}
                    </span>
                    <CategoryPicker
                      ariaLabel={`Category ${i + 1}`}
                      categories={categories}
                      value={slot.category_id}
                      onChange={(id) => setSlot(i, { category_id: id })}
                      iconFor={(id) => CATEGORY_ICON[id] ?? CATEGORY_ICON_FALLBACK}
                    />
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
                  <div className="pl-9">
                    <AmountPicker
                      label="Monthly spend"
                      value={slot.monthly_inr}
                      onChange={(n) => setSlot(i, { monthly_inr: n })}
                      min={0}
                      max={100000}
                      step={1000}
                      presets={SPEND_PRESETS}
                    />
                  </div>
                </div>
              ))}
            </div>

            {slots.length < 6 && (
              <button
                onClick={addSlot}
                className="mt-5 rounded-lg border px-3 py-1.5 text-[13px]"
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
            <SectionTitle description="All your other card spend in a month. This is mandatory — fee waivers and spend milestones are calculated on your total, not just the named categories.">
              Everything else
            </SectionTitle>
            <AmountPicker
              label="Residual monthly spend"
              value={residual}
              onChange={setResidual}
              min={0}
              max={200000}
              step={1000}
              presets={RESIDUAL_PRESETS}
            />
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
              <b className="font-mono-num">
                <AnimatedNumber value={monthlyTotal} format={formatInr} />
              </b>{" "}
              <span style={{ color: "var(--ink-faint)" }}>
                · {formatLakh(monthlyTotal * 12)} a year
              </span>
            </p>
          </Card>
        </motion.div>
      )}

      {/* ── STEP 3 — Preferences ── */}
      {step === 2 && (
        <motion.div
          key="step-2"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={STEP_TRANSITION}
          className="space-y-4"
        >
          <Card className="p-6">
            <SectionTitle description="This picks which redemption rate each card is valued at — the same pile of points can be worth three times as much through one exit as another.">
              How do you want to be rewarded?
            </SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <IconTile
                  key={c.id}
                  icon={c.icon}
                  label={c.label}
                  hint={c.hint}
                  selected={channel === c.id}
                  onClick={() => setChannel(c.id)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle description="A hard filter: any card whose sticker fee is above this is removed, even if the fee would be waived at your spend level.">
              What annual fee works for you?
            </SectionTitle>
            <AmountPicker
              label="Fee budget"
              value={feeComfort}
              onChange={setFeeComfort}
              min={0}
              max={60000}
              step={250}
              presets={FEE_PRESETS}
            />
          </Card>

          <Card className="p-6">
            <SectionTitle description="Used only to break ties between cards that are close on money. Never changes the value calculation itself.">
              Merchants you use often <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>(optional)</span>
            </SectionTitle>
            <div className="flex flex-wrap gap-2">
              {merchants.map((m) => {
                const on = pickedMerchants.includes(m.merchant_id);
                return (
                  <Chip
                    key={m.merchant_id}
                    selected={on}
                    onClick={() =>
                      setPickedMerchants((prev) =>
                        on ? prev.filter((x) => x !== m.merchant_id) : [...prev, m.merchant_id],
                      )
                    }
                    className="gap-2"
                  >
                    {m.display_name}
                    {m.has_cobrand_card && <Pill tone="gold">co-brand</Pill>}
                  </Chip>
                );
              })}
            </div>
          </Card>

          {error && <Callout tone="rose">{error}</Callout>}
        </motion.div>
      )}
      </AnimatePresence>

      {/* nav */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          Back
        </Button>

        {step < 2 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === SPENDING_STEP && duplicateCategory}
            arrow
          >
            Continue
          </Button>
        ) : (
          <Button onClick={submit} disabled={loading} arrow>
            {loading ? "Calculating…" : "Find my card"}
          </Button>
        )}
      </div>
    </div>
  );
}
