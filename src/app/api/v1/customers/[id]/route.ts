import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/customers/[id] — Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "read");
    const { data, error } = await auth.supabase
      .from("customers")
      .select(`*, portal_users(*)`)
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/customers/[id] — Update customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const body = await request.json();
    const {
      company_name, contact_name, is_b2b, n_tahiti,
      email, phone, address_line1, address_line2,
      city, island, postal_code, portal_enabled,
      payment_terms, notes, consent_recorded,
    } = body;

    if (is_b2b && !n_tahiti) {
      return NextResponse.json({ error: "n_tahiti is required for B2B customers" }, { status: 400 });
    }

    const updatePayload: Record<string, string | number | boolean | null> = {};
    const updatableFields = [
      "company_name", "contact_name", "is_b2b", "n_tahiti",
      "email", "phone", "address_line1", "address_line2",
      "city", "island", "postal_code", "portal_enabled",
      "payment_terms", "notes", "assigned_to", "customer_type",
    ] as const;

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (consent_recorded === true) {
      updatePayload.consent_recorded = true;
      updatePayload.consent_recorded_at = new Date().toISOString();
    }

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();

      const { error: updateError } = await auth.supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", id)
        .eq("team_id", teamId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
    }

    const { data, error: fetchError } = await auth.supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// DELETE /api/v1/customers/[id] — Delete a customer
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(_request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { error } = await auth.supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
