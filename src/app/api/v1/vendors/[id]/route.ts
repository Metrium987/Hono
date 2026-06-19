import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

// GET /api/v1/vendors/[id] — Get a single vendor
export async function GET(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "read");
    const { id } = await props.params;

    const { data, error } = await auth.supabase
      .from("vendors")
      .select("*")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/vendors/[id] — Update a vendor
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { id } = await props.params;
    const body = await request.json();

    const allowedFields = ["name", "contact_name", "email", "phone", "address", "n_tahiti", "notes"];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("vendors")
      .update(updates)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/vendors/[id] — Delete a vendor
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { id } = await props.params;

    const { error } = await auth.supabase
      .from("vendors")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
