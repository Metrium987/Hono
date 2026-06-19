import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/customers — List customers for a team (with search and pagination)
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "clients", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const search = params.get("search");
    const isB2b = params.get("is_b2b");
    const portalEnabled = params.get("portal_enabled");
    const source = params.get("source");

    let query = auth.supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("team_id", teamId);

    if (isB2b !== null && isB2b !== undefined) {
      query = query.eq("is_b2b", isB2b === "true");
    }
    if (portalEnabled !== null && portalEnabled !== undefined) {
      query = query.eq("portal_enabled", portalEnabled === "true");
    }
    if (source) {
      query = query.eq("source", source);
    }
    if (search) {
      query = query.or(
        `contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,n_tahiti.ilike.%${search}%`
      );
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/customers — Create a customer
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const body = await request.json();
    const {
      company_name, contact_name, is_b2b,
      n_tahiti, email, phone, address_line1, address_line2,
      city, island, postal_code, portal_enabled, payment_terms,
      notes, consent_recorded, source,
    } = body;

    if (!contact_name) {
      return NextResponse.json({ error: "contact_name is required" }, { status: 400 });
    }
    if (is_b2b && !n_tahiti) {
      return NextResponse.json({
        error: "n_tahiti (Tahiti business registration number) is required for B2B customers",
      }, { status: 400 });
    }

    const { data: customer, error: custError } = await auth.supabase
      .from("customers")
      .insert({
        team_id: teamId,
        company_name: company_name ?? null,
        contact_name,
        is_b2b: is_b2b ?? false,
        n_tahiti: n_tahiti ?? null,
        email: email ?? null,
        phone: phone ?? null,
        address_line1: address_line1 ?? null,
        address_line2: address_line2 ?? null,
        city: city ?? null,
        island: island ?? null,
        postal_code: postal_code ?? null,
        portal_enabled: portal_enabled ?? false,
        payment_terms: payment_terms ?? 30,
        notes: notes ?? null,
        consent_recorded: consent_recorded ?? false,
        consent_recorded_at: consent_recorded ? new Date().toISOString() : null,
        source: source ?? "erp",
      })
      .select()
      .single();

    if (custError) {
      return NextResponse.json({ error: custError.message }, { status: 400 });
    }

    return NextResponse.json({ data: customer }, { status: 201 });
  });
}
