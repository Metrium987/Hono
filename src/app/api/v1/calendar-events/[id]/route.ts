import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const body = await request.json();
    const { title, description, starts_at, ends_at, event_type, is_all_day, customer_id, group_id, location } = body;

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description ?? null;
    if (starts_at !== undefined) update.starts_at = starts_at;
    if (ends_at !== undefined) update.ends_at = ends_at;
    if (event_type !== undefined) update.event_type = event_type;
    if (is_all_day !== undefined) update.is_all_day = is_all_day;
    if (customer_id !== undefined) update.customer_id = customer_id ?? null;
    if (group_id !== undefined) update.group_id = group_id ?? null;
    if (location !== undefined) update.location = location ?? null;

    const { data, error } = await auth.supabase
      .from("calendar_events")
      .update(update)
      .eq("id", id)
      .eq("team_id", teamId)
      .select("*, customer:customer_id(contact_name, company_name), group:group_id(name, color)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  });
}

export async function DELETE(request: NextRequest, props: { params: Params }) {
  const { id } = await props.params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "clients", "write");
    const { error } = await auth.supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("team_id", teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  });
}
