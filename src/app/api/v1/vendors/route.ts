import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  n_tahiti: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// GET /api/v1/vendors — List vendors for a team
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "clients", "read");
    const page = Math.max(1, parseInt(params.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")));
    const offset = (page - 1) * limit;
    const rawSearch = params.get("search");
    const search = rawSearch ? rawSearch.replace(/[,()'"]/g, "").trim() : null;

    let query = auth.supabase
      .from("vendors")
      .select("id, name, contact_name, email, phone, address, n_tahiti, notes, created_at", { count: "exact" })
      .eq("team_id", teamId)
      .is("deleted_at", null);

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
    const parsed = createVendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { name, contact_name, email, phone, address, n_tahiti, notes } = parsed.data;

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
