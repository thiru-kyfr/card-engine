import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCatalog, CatalogError } from "@/catalog/load";
import { userProfileSchema } from "@/engine/schema";
import { recommend } from "@/engine";
import type { UserProfile } from "@/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = userProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid profile.",
        details: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      },
      { status: 422 },
    );
  }

  try {
    const catalog = loadCatalog();

    // Reject spend in categories the catalog does not define — otherwise the
    // engine would silently value it at base rate and nobody would know why.
    const known = new Set(catalog.categories.map((c) => c.category_id));
    const unknown = parsed.data.spend.map((s) => s.category_id).filter((c) => !known.has(c));
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: "Unknown spend category.", details: unknown },
        { status: 422 },
      );
    }

    const result = recommend(catalog, parsed.data as UserProfile);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof CatalogError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: 500 });
    }
    console.error("[recommend] unexpected error", e);
    return NextResponse.json({ error: "Engine failure." }, { status: 500 });
  }
}
