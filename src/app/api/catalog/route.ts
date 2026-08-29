import { NextResponse } from "next/server";
import { loadCatalog, CatalogError, selectableCategories, pickerMerchants } from "@/catalog/load";

export const runtime = "nodejs";

export async function GET() {
  try {
    const catalog = loadCatalog();
    return NextResponse.json({
      categories: selectableCategories(catalog),
      merchants: pickerMerchants(catalog),
      cards: catalog.cards
        .filter((c) => c.status === "active")
        .map((c) => ({ card_id: c.card_id, name: c.name, issuer: c.issuer, tier: c.tier })),
      config: catalog.config,
    });
  } catch (e) {
    if (e instanceof CatalogError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: 500 });
    }
    return NextResponse.json({ error: "Catalog failure." }, { status: 500 });
  }
}
