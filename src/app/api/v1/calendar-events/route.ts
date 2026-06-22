import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateCalendarEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  event_type: z.enum(["meeting", "call", "task", "reminder", "other"]).optional(),
  is_all_day: z.boolean().optional(),
  customer_id: z.string().uuid().optional().nullable(),
  group_id: z.string().uuid().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "read");
    const url = new URL(request.url);
    const startsAt = url.searchParams.get("starts_at");
    const endsAt = url.searchParams.get("ends_at");

    let query = auth.supabase
      .from("calendar_events")
      .select("*, customer:customer_id(contact_name, company_name), group:group_id(name, color)")
      .eq("team_id", teamId)
      .order("starts_at");

    if (startsAt) query = query.gte("starts_at", startsAt);
    if (endsAt) query = query.lte("starts_at", endsAt);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const parsed = CreateCalendarEventSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { title, description, starts_at, ends_at, event_type, is_all_day, customer_id, group_id, location } = parsed.data;

    const { data, error } = await auth.supabase
      .from("calendar_events")
      .insert({
        team_id: teamId,
        title: title.trim(),
        description: description ?? null,
        starts_at,
        ends_at,
        event_type: event_type ?? "meeting",
        is_all_day: is_all_day ?? false,
        customer_id: customer_id ?? null,
        group_id: group_id ?? null,
        location: location ?? null,
        created_by: auth.userId,
      })
      .select("*, customer:customer_id(contact_name, company_name), group:group_id(name, color)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data }, { status: 201 });
  });
}

