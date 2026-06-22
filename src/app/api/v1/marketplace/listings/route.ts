import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "marketplace", "read");
    const status = params.get("status");
    const productId = params.get("product_id");

    let query = auth.supabase
      .from("marketplace_listings")
      .select("*, product:product_id(id, name, sku), account:marketplace_account_id(id, platform, account_name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (productId) query = query.eq("product_id", productId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "marketplace", "write");
    const body = await request.json();
    const { product_id, marketplace_account_id, platform_item_id, title, price, permalink } = body;

    if (!product_id) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    if (!platform_item_id?.trim()) return NextResponse.json({ error: "platform_item_id is required" }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (!price || price < 0) return NextResponse.json({ error: "price must be >= 0" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("marketplace_listings")
      .insert({
        team_id: teamId,
        product_id,
        marketplace_account_id: marketplace_account_id ?? null,
        platform_item_id: platform_item_id.trim(),
        title: title.trim(),
        price,
        permalink: permalink?.trim() ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
