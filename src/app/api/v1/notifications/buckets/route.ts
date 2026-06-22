import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "read");

    const { data, error } = await auth.supabase
      .from("notification_buckets")
      .select("*, assignees:notification_bucket_assignees(user_id)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "write");
    const body = await request.json();
    const { bucket, label } = body;

    if (!bucket) return NextResponse.json({ error: "bucket is required" }, { status: 400 });

    const { data, error } = await auth.supabase
      .from("notification_buckets")
      .insert({ team_id: teamId, bucket, label: label?.trim() ?? null })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
