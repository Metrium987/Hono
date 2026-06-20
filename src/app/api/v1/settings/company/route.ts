import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/settings/company — Get company/team settings
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");
    const { data, error } = await auth.supabase
      .from("teams")
      .select(`
        id, name, email, phone,
        address_line1, address_line2, city, island, postal_code, country,
        n_tahiti, dicp_id, rcs_number, tax_id, is_franchise_en_base,
        logo_url, website, default_currency_id,
        invoice_prefix, quote_prefix, late_fee_fixed,
        bank_name, bank_rib, bank_iban, bank_bic,
        timezone, is_educational_mode
      `)
      .eq("id", teamId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  });
}

// PATCH /api/v1/settings/company — Update company/team settings
export async function PATCH(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const allowedFields = [
      "name", "email", "phone",
      "address_line1", "address_line2", "city", "island", "postal_code", "country",
      "n_tahiti", "dicp_id", "rcs_number", "tax_id", "is_franchise_en_base",
      "logo_url", "website", "default_currency_id",
      "invoice_prefix", "quote_prefix", "late_fee_fixed",
      "bank_name", "bank_rib", "bank_iban", "bank_bic",
      "timezone", "is_educational_mode",
    ];

    const updates: Record<string, string | number | boolean | null> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("teams")
      .update(updates)
      .eq("id", teamId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  });
}
