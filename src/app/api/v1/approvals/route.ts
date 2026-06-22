import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { z } from "zod";

const CreateApprovalSchema = z.object({
  approval_type: z.string().min(1).max(100),
  entity_type: z.string().min(1).max(100),
  entity_id: z.string().uuid(),
  reason: z.string().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  expires_at: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "governance", "read");
    const approvalType = params.get("approval_type");
    const status = params.get("status");

    let query = auth.supabase
      .from("approvals")
      .select("*, requested_by_user:requested_by(id, full_name), resolved_by_user:resolved_by(id, full_name)")
      .eq("team_id", teamId)
      .order("requested_at", { ascending: false });

    if (approvalType) query = query.eq("approval_type", approvalType);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "governance", "write");
    const parsed = CreateApprovalSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
    const { approval_type, entity_type, entity_id, reason, metadata, expires_at } = parsed.data;

    const { data, error } = await auth.supabase
      .from("approvals")
      .insert({
        team_id: teamId,
        approval_type,
        entity_type,
        entity_id,
        requested_by: auth.userId,
        reason: reason?.trim() ?? null,
        metadata: metadata ?? null,
        expires_at: expires_at ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}

