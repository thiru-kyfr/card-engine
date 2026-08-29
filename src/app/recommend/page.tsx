import { loadCatalog, CatalogError, selectableCategories, pickerMerchants } from "@/catalog/load";
import { RecommendFlow } from "@/components/RecommendFlow";
import { Callout } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function RecommendPage() {
  try {
    const catalog = loadCatalog();
    return (
      <RecommendFlow
        categories={selectableCategories(catalog)}
        merchants={pickerMerchants(catalog)}
      />
    );
  } catch (e) {
    const err = e instanceof CatalogError ? e : null;
    return (
      <Callout tone="rose">
        <b>The catalog could not be loaded.</b>
        <p className="mt-1">{err?.message ?? "Unknown error."}</p>
        {err?.details?.length ? (
          <ul className="mt-2 list-disc pl-5 font-mono-num text-[12px]">
            {err.details.slice(0, 20).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : null}
      </Callout>
    );
  }
}
