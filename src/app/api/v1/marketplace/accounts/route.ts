import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "marketplace", "read");

    const { data, error } = await auth.supabase
      .from("marketplace_accounts")
      .select("id, platform, account_name, platform_user_id, is_active, token_expires_at, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "marketplace", "write");
    const body = await request.json();
    const { platform, account_name, platform_user_id, access_token, refresh_token, token_expires_at } = body;

    if (!platform?.trim()) return NextResponse.json({ error: "platform is required" }, { status: 400 });
    if (!account_name?.trim()) return NextResponse.json({ error: "account_name is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("marketplace_accounts")
      .insert({
        team_id: teamId,
        platform: platform.trim(),
        account_name: account_name.trim(),
        platform_user_id: platform_user_id?.trim() ?? null,
        access_token: access_token ?? null,
        refresh_token: refresh_token ?? null,
        token_expires_at: token_expires_at ?? null,
        is_active: true,
      })
      .select("id, platform, account_name, platform_user_id, is_active, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
