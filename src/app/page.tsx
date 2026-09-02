import Link from "next/link";
import { loadCatalog } from "@/catalog/load";
import { Callout, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  let cardCount = 0;
  let catCount = 0;
  let error: string | null = null;
  try {
    const catalog = loadCatalog();
    cardCount = catalog.cards.filter((c) => c.status === "active").length;
    catCount = catalog.categories.length;
  } catch {
    error = "We're having trouble loading card data right now. Please try again shortly.";
  }

  return (
    <div className="flex min-h-[70vh] flex-col justify-center">
      <div className="max-w-2xl">
        <p
          className="mb-4 flex items-center gap-2 font-mono-num text-[11.5px] uppercase tracking-[0.11em]"
          style={{ color: "var(--teal)" }}
        >
          <span className="inline-block h-px w-4" style={{ background: "var(--teal)" }} />
          Real rupees, not a marketing score
        </p>
        <h1 className="mb-5 text-5xl leading-[1.08]">
          Which credit card is actually worth the most to you?
        </h1>
        <p className="text-[16px]" style={{ color: "var(--ink-muted)" }}>
          Tell us where your money goes. We&rsquo;ll tell you what each card would actually earn
          you in a year — no jargon, no score out of 100.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/recommend">
            <Button arrow>Find my card</Button>
          </Link>
          <Link href="/catalog">
            <Button variant="secondary">Compare cards</Button>
          </Link>
        </div>

        {error ? (
          <div className="mt-10">
            <Callout tone="rose">{error}</Callout>
          </div>
        ) : (
          <p
            className="mt-10 font-mono-num text-[12.5px]"
            style={{ color: "var(--ink-faint)" }}
          >
            {cardCount} cards compared · {catCount} spending categories · fees always included
          </p>
        )}
      </div>
    </div>
  );
}
