import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { generateEmbedding } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { entity, ids } = body;

    if (!entity || !["product", "customer"].includes(entity)) {
      return NextResponse.json({ error: "entity must be 'product' or 'customer'" }, { status: 400 });
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeIds = Array.isArray(ids)
      ? ids.filter((id: unknown) => typeof id === "string" && UUID_RE.test(id))
      : [];

    const table = entity === "product" ? "products" : "customers";

    let query = auth.supabase
      .from(table)
      .select("id, name, description")
      .eq("team_id", teamId);

    if (safeIds.length > 0) {
      query = query.not("id", "in", `(${safeIds.join(",")})`);
    }

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const results: Array<{ id: string; status: "ok" | "skipped" | "error"; error?: string }> = [];

    for (const row of rows ?? []) {
      const text = [row.name, row.description].filter(Boolean).join(" ");
      if (!text.trim()) {
        results.push({ id: row.id, status: "skipped" });
        continue;
      }
      try {
        const vector = await generateEmbedding(text);
        const { error: updateError } = await auth.supabase
          .from(table)
          .update({ embedding: vector })
          .eq("id", row.id)
          .eq("team_id", teamId);
        if (updateError) {
          results.push({ id: row.id, status: "error", error: updateError.message });
        } else {
          results.push({ id: row.id, status: "ok" });
        }
      } catch (err) {
        results.push({ id: row.id, status: "error", error: err instanceof Error ? err.message : "Embedding failed" });
      }
    }

    return NextResponse.json({ data: results });
  });
}
