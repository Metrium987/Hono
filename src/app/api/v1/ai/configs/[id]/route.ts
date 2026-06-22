import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const allowed = ["system_prompt", "few_shot_examples", "business_context", "category_rules", "active"] as const;
    for (const field of allowed) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const { data, error } = await auth.supabase
      .from("ai_prompt_configs")
      .update(updates)
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data });
  });
}
