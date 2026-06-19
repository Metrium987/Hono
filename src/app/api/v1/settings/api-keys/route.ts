import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { createHash, randomBytes } from "node:crypto";

// GET /api/v1/settings/api-keys — List API keys for a team (without key_hash)
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "read");
    const { data, error } = await auth.supabase
      .from("api_keys")
      .select("id, name, description, key_prefix, role_id, expires_at, last_used_at, revoked_at, created_at")
      .eq("team_id", teamId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  });
}

// POST /api/v1/settings/api-keys — Create a new API key
export async function POST(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const body = await request.json();
    const { name, description, role_id, expires_in_days } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Generate a key: hk_ + random bytes (34 chars total)
    const rawKey = "hk_" + randomBytes(24).toString("hex");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 8); // e.g. "hk_a1b2c3"

    // Calculate expiry
    let expiresAt: string | null = null;
    if (expires_in_days && parseInt(expires_in_days) > 0) {
      expiresAt = new Date(Date.now() + parseInt(expires_in_days) * 86400000).toISOString();
    }

    const { data, error } = await auth.supabase
      .from("api_keys")
      .insert({
        team_id: teamId,
        name,
        description: description ?? null,
        role_id: role_id ?? null,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        expires_at: expiresAt,
      })
      .select("id, name, description, key_prefix, expires_at, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return the raw key ONCE on creation
    return NextResponse.json({
      data: { ...data, raw_key: rawKey },
      message: "Save this key — it will not be shown again.",
    }, { status: 201 });
  });
}

// DELETE /api/v1/settings/api-keys?id=xxx — Revoke an API key
export async function DELETE(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "settings", "write");
    const id = params.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param is required" }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  });
}
