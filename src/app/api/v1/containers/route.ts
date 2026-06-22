import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateContainerSchema = z.object({
  container_number: z.string().min(1).max(100),
  vendor_id: z.string().uuid().optional().nullable(),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cost_fob: z.number().min(0).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "inventory", "read");
    const status = params.get("status");

    let query = auth.supabase
      .from("containers")
      .select("*, vendor:vendor_id(id, name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const parsed = CreateContainerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { container_number, vendor_id, departure_date, arrival_date, cost_fob, notes } = parsed.data;

    const { data, error } = await auth.supabase
      .from("containers")
      .insert({
        team_id: teamId,
        container_number: container_number.trim(),
        vendor_id: vendor_id ?? null,
        departure_date: departure_date ?? null,
        arrival_date: arrival_date ?? null,
        cost_fob: cost_fob ?? null,
        notes: notes?.trim() ?? null,
        status: "created",
        created_by: auth.userId,
      })
      .select("*, vendor:vendor_id(id, name)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}

