import Link from "next/link";
import { loadCatalog, CatalogError, staleCards } from "@/catalog/load";
import { Card, Callout, SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  let cardCount = 0;
  let catCount = 0;
  let stale = 0;
  let error: string | null = null;
  try {
    const catalog = loadCatalog();
    cardCount = catalog.cards.filter((c) => c.status === "active").length;
    catCount = catalog.categories.length;
    stale = staleCards(catalog).length;
  } catch (e) {
    error = e instanceof CatalogError ? e.message : "Catalog failed to load.";
  }

  return (
    <div>
      <div className="mb-10 max-w-3xl">
        <p
          className="mb-3 flex items-center gap-2 font-mono-num text-[11.5px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          Deterministic · explainable · ranked in rupees
        </p>
        <h1 className="mb-4 text-4xl leading-[1.1]">Which credit card is actually worth the most to you?</h1>
        <p className="text-[15.5px]" style={{ color: "var(--ink-muted)" }}>
          Tell us what you spend and how you want to be rewarded. The engine values every card in
          the catalog in rupees per year — points earned, caps hit, redemption rate, milestones, fee
          — and shows you the whole calculation, not a score.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/recommend"
            className="rounded-lg px-6 py-3 text-[14px] font-semibold no-underline"
            style={{ background: "var(--teal)", color: "#fff" }}
          >
            Find my card
          </Link>
          <Link
            href="/catalog"
            className="rounded-lg border px-6 py-3 text-[14px] no-underline"
            style={{ borderColor: "var(--line-strong)", color: "var(--ink)" }}
          >
            Browse the catalog
          </Link>
        </div>
      </div>

      {error ? (
        <Callout tone="rose">
          <b>Catalog error:</b> {error}
        </Callout>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <SectionLabel>Catalog</SectionLabel>
            <p className="font-mono-num text-2xl font-semibold">{cardCount}</p>
            <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              active cards loaded from YAML, schema-validated at boot
            </p>
          </Card>
          <Card className="p-5">
            <SectionLabel>Taxonomy</SectionLabel>
            <p className="font-mono-num text-2xl font-semibold">{catCount}</p>
            <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              spend categories with MCC mappings, shared across every card
            </p>
          </Card>
          <Card className="p-5" accent={stale > 0 ? "gold" : undefined}>
            <SectionLabel>Freshness</SectionLabel>
            <p className="font-mono-num text-2xl font-semibold" style={stale > 0 ? { color: "var(--gold)" } : undefined}>
              {stale}
            </p>
            <p className="text-[12.5px]" style={{ color: "var(--ink-muted)" }}>
              cards past the staleness window and due re-verification
            </p>
          </Card>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <SectionLabel>How it ranks</SectionLabel>
          <p className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Net Annual Value in rupees: rewards + milestones − effective fee − forex. Not a
            weighted score. Every number on screen can be traced back to a line in the catalog.
          </p>
        </Card>
        <Card className="p-5">
          <SectionLabel>What it will not do</SectionLabel>
          <p className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Count lounge access you will never use, assume you execute the perfect airline
            transfer, or let a one-time welcome bonus win a steady-state comparison.
          </p>
        </Card>
        <Card className="p-5">
          <SectionLabel>Where the weighting lives</SectionLabel>
          <p className="text-[13.5px]" style={{ color: "var(--ink-muted)" }}>
            Your rupee amounts carry it. Positional weights (3/2/1) apply only when two cards land
            within 10% of each other — at that point money can no longer decide honestly.
          </p>
        </Card>
      </div>
    </div>
  );
}
