import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

// GET /api/v1/vendors — List vendors for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "clients", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const search = params.get("search");

    let query = auth.supabase
      .from("vendors")
      .select("*", { count: "exact" })
      .eq("team_id", teamId);

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });
  });
}

// POST /api/v1/vendors — Create a vendor
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const body = await request.json();
    const { name, contact_name, email, phone, address, n_tahiti, notes } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("vendors")
      .insert({
        team_id: teamId,
        name,
        contact_name: contact_name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        address: address ?? null,
        n_tahiti: n_tahiti ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}
