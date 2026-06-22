import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "read");

    const { data, error } = await auth.supabase
      .from("container_documents")
      .select("id, document_type, file_name, file_url, notes, created_at")
      .eq("container_id", id)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "inventory", "write");
    const body = await request.json();
    const { document_type, file_name, file_url, notes } = body;

    if (!document_type?.trim()) {
      return NextResponse.json({ error: "document_type is required" }, { status: 400 });
    }
    if (!file_name?.trim()) {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 });
    }
    if (!file_url?.trim()) {
      return NextResponse.json({ error: "file_url is required" }, { status: 400 });
    }

    const { data: container } = await auth.supabase
      .from("containers")
      .select("id")
      .eq("id", id)
      .eq("team_id", teamId)
      .single();

    if (!container) return NextResponse.json({ error: "Container not found" }, { status: 404 });

    const { data, error } = await auth.supabase
      .from("container_documents")
      .insert({
        team_id: teamId,
        container_id: id,
        document_type: document_type.trim(),
        file_name: file_name.trim(),
        file_url: file_url.trim(),
        notes: notes?.trim() ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
