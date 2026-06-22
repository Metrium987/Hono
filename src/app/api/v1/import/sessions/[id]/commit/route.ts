import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");

    const { data: session, error: sessErr } = await auth.supabase
      .from("import_sessions")
      .select("id, status")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (sessErr || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status === "done") return NextResponse.json({ error: "Already committed" }, { status: 409 });

    const { data: rows } = await auth.supabase
      .from("import_session_rows")
      .select("id, action, raw_data, normalized_data, resolved_product_id, resolved_category_id, resolved_brand_id")
      .eq("import_session_id", id)
      .eq("team_id", teamId)
      .not("action", "is", null);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows ?? []) {
      try {
        const data = row.normalized_data ?? row.raw_data;
        if (row.action === "skip") { skipped++; continue; }

        if (row.action === "insert") {
          const { error } = await auth.supabase.from("products").insert({
            team_id: teamId,
            name: data.name ?? "Sans nom",
            sku: data.sku ?? null,
            price_ht: data.price_ht ?? 0,
            currency_id: data.currency_id,
            category_id: row.resolved_category_id ?? data.category_id ?? null,
            brand_id: row.resolved_brand_id ?? data.brand_id ?? null,
            barcode: data.barcode ?? null,
            weight: data.weight ?? null,
            units_per_box: data.units_per_box ?? 1,
            is_active: true,
            is_published: false,
          });
          if (error) { failed++; await auth.supabase.from("import_session_rows").update({ status: "error", errors: { message: error.message } }).eq("id", row.id); }
          else { inserted++; await auth.supabase.from("import_session_rows").update({ status: "success" }).eq("id", row.id); }
        }

        if (row.action === "update" && row.resolved_product_id) {
          const updateData: Record<string, unknown> = {};
          if (data.price_ht !== undefined) updateData.price_ht = data.price_ht;
          if (data.barcode !== undefined) updateData.barcode = data.barcode;
          if (data.weight !== undefined) updateData.weight = data.weight;
          if (row.resolved_category_id) updateData.category_id = row.resolved_category_id;
          if (row.resolved_brand_id) updateData.brand_id = row.resolved_brand_id;

          const { error } = await auth.supabase.from("products").update(updateData).eq("id", row.resolved_product_id).eq("team_id", teamId);
          if (error) { failed++; await auth.supabase.from("import_session_rows").update({ status: "error", errors: { message: error.message } }).eq("id", row.id); }
          else { updated++; await auth.supabase.from("import_session_rows").update({ status: "success" }).eq("id", row.id); }
        }
      } catch {
        failed++;
      }
    }

    await auth.supabase
      .from("import_sessions")
      .update({ status: "done", inserted, updated, skipped, failed })
      .eq("id", id);

    return NextResponse.json({ inserted, updated, skipped, failed });
  });
}
