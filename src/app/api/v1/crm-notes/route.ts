import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateCrmNoteSchema = z.object({
  customer_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

// GET /api/v1/crm-notes â€” List CRM notes for a customer (filter: customer_id)
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "clients", "read");

    const customerId = params.get("customer_id");
    const limit = Math.min(100, parseInt(params.get("limit") ?? "50"));
    const offset = Math.max(0, parseInt(params.get("offset") ?? "0"));

    let query = auth.supabase
      .from("crm_notes")
      .select("*, author:author_id(id, full_name)", { count: "exact" })
      .eq("team_id", teamId);

    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, count: count ?? 0 });
  });
}

// POST /api/v1/crm-notes â€” Create a CRM note
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");

    const parsed = CreateCrmNoteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { customer_id, content } = parsed.data;

    const { data, error } = await auth.supabase
      .from("crm_notes")
      .insert({
        team_id: teamId,
        customer_id,
        content,
        author_id: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  });
}

