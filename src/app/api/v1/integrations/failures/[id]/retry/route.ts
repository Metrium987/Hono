import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "integrations", "write");

    const { data: failure } = await auth.supabase
      .from("integration_failures")
      .select("id, retry_count, max_retries, is_resolved")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!failure) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (failure.is_resolved) return NextResponse.json({ error: "Already resolved" }, { status: 400 });
    if (failure.retry_count >= failure.max_retries) {
      return NextResponse.json({ error: `Max retries (${failure.max_retries}) reached` }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("integration_failures")
      .update({ retry_count: failure.retry_count + 1 })
      .eq("id", id)
      .eq("team_id", teamId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data });
  });
}
