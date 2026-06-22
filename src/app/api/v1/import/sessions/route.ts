import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "read");

    const { data, error } = await auth.supabase
      .from("import_sessions")
      .select("id, type, status, filename, total_rows, valid_rows, error_rows, inserted, updated, skipped, failed, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "catalog", "write");
    const body = await request.json();
    const { filename, rows, type } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "rows array is required" }, { status: 400 });
    }

    const { data: session, error: sessionErr } = await auth.supabase
      .from("import_sessions")
      .insert({
        team_id: teamId,
        user_id: auth.userId,
        type: type ?? "catalog",
        status: "pending",
        filename: filename ?? null,
        total_rows: rows.length,
      })
      .select()
      .single();

    if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 400 });

    const rowRecords = rows.map((row: Record<string, unknown>, idx: number) => ({
      team_id: teamId,
      import_session_id: session.id,
      row_index: idx,
      status: "pending",
      raw_data: row,
    }));

    const { error: rowsErr } = await auth.supabase
      .from("import_session_rows")
      .insert(rowRecords);

    if (rowsErr) {
      await auth.supabase.from("import_sessions").delete().eq("id", session.id);
      return NextResponse.json({ error: rowsErr.message }, { status: 400 });
    }

    await auth.supabase
      .from("import_sessions")
      .update({ status: "validating", valid_rows: rows.length })
      .eq("id", session.id);

    return NextResponse.json({ data: session }, { status: 201 });
  });
}
