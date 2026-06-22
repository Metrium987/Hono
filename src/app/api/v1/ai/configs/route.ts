import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "settings", "read");
    const activeOnly = params.get("active") !== "false";

    let query = auth.supabase
      .from("ai_prompt_configs")
      .select("id, config_key, system_prompt, few_shot_examples, business_context, category_rules, active, created_at, updated_at")
      .eq("team_id", teamId)
      .order("config_key", { ascending: true });

    if (activeOnly) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { config_key, system_prompt, few_shot_examples, business_context, category_rules, active } = body;

    if (!config_key?.trim()) return NextResponse.json({ error: "config_key is required" }, { status: 400 });
    if (!system_prompt?.trim()) return NextResponse.json({ error: "system_prompt is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("ai_prompt_configs")
      .upsert({
        team_id: teamId,
        config_key: config_key.trim(),
        system_prompt: system_prompt.trim(),
        few_shot_examples: few_shot_examples ?? [],
        business_context: business_context?.trim() ?? null,
        category_rules: category_rules?.trim() ?? null,
        active: active ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "team_id, config_key" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
