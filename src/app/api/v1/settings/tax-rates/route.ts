import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/settings/tax-rates — List all tax rates for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "taxes", "read");
    const { data, error } = await auth.supabase
      .from("tax_rates")
      .select("*")
      .eq("team_id", teamId)
      .order("rate", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/settings/tax-rates — Create a tax rate
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "taxes", "write");
    const body = await request.json();
    const { name, rate, description, is_active } = body;

    if (!name || rate == null) {
      return NextResponse.json({ error: "name and rate are required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("tax_rates")
      .insert({
        team_id: teamId,
        name,
        rate,
        description: description ?? null,
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

// PATCH /api/v1/settings/tax-rates?id=xxx — Update a tax rate
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "taxes", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const allowedFields = ["name", "rate", "description", "is_active"];
    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("tax_rates")
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

// DELETE /api/v1/settings/tax-rates?id=xxx — Delete a tax rate
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "taxes", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("tax_rates")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json({
          error: "Cannot delete tax rate that is in use on invoices or products",
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
