import { notFound } from "next/navigation";
import { loadCatalog, CatalogError } from "@/catalog/load";
import { DebugConsole } from "@/components/DebugConsole";
import { Callout } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  try {
    const catalog = loadCatalog();
    return (
      <DebugConsole
        categories={catalog.categories}
        config={catalog.config}
        cardCount={catalog.cards.length}
      />
    );
  } catch (e) {
    const err = e instanceof CatalogError ? e : null;
    return (
      <Callout tone="rose">
        <b>Catalog failed validation.</b>
        <p className="mt-1">{err?.message}</p>
        {err?.details?.length ? (
          <ul className="mt-2 list-disc pl-5 font-mono-num text-[12px]">
            {err.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </Callout>
    );
  }
}
