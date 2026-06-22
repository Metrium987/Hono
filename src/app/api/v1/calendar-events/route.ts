import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

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
    const body = await request.json();
    const { title, description, starts_at, ends_at, event_type, is_all_day, customer_id, group_id, location } = body;

    if (!title?.trim() || !starts_at || !ends_at) {
      return NextResponse.json({ error: "title, starts_at, ends_at requis" }, { status: 400 });
    }

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
