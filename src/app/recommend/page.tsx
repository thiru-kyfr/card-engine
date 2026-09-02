import { loadCatalog, selectableCategories, pickerMerchants } from "@/catalog/load";
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
  } catch {
    return (
      <Callout tone="rose">
        We&rsquo;re having trouble loading card data right now. Please try again shortly.
      </Callout>
    );
  }
}
