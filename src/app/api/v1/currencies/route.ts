import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/currencies — List all currencies for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "currencies", "read");
    const { data, error } = await auth.supabase
      .from("currencies")
      .select("*")
      .eq("team_id", teamId)
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/currencies — Create a currency
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "currencies", "write");
    const body = await request.json();
    const { code, name, symbol, symbol_position, is_default, exchange_rate_to_xpf, is_active } = body;

    if (!code || !name || !symbol) {
      return NextResponse.json({ error: "code, name, and symbol are required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("currencies")
      .insert({
        team_id: teamId,
        code: code.toUpperCase(),
        name,
        symbol,
        symbol_position: symbol_position ?? "prefix",
        is_default: is_default ?? false,
        exchange_rate_to_xpf: exchange_rate_to_xpf ?? null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}

// PATCH /api/v1/currencies?id=xxx — Update a currency
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "currencies", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ["code", "name", "symbol", "symbol_position", "is_default", "exchange_rate_to_xpf", "is_active"];
    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = field === "code" ? body[field].toUpperCase() : body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("currencies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/currencies?id=xxx — Delete a currency
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "currencies", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    // Prevent deleting default currency
    const { data: currency } = await auth.supabase
      .from("currencies")
      .select("is_default")
      .eq("id", id)
      .single();

    if (currency?.is_default) {
      return NextResponse.json({
        error: "Cannot delete the default currency. Set another currency as default first.",
      }, { status: 409 });
    }

    const { error } = await auth.supabase
      .from("currencies")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({
          error: "Cannot delete currency that is in use on invoices or products",
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
