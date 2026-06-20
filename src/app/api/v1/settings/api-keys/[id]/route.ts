import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

type Params = Promise<{ id: string }>;

// PATCH /api/v1/settings/api-keys/[id] — Update an API key (e.g., revoke)
export async function PATCH(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const rateKey = `api_keys:${teamId}`;
    const rateResult = await rateLimit(rateKey, RATE_LIMIT_CONFIGS.API_KEYS);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
    const { id } = await props.params;

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

// DELETE /api/v1/settings/api-keys/[id] — Revoke an API key
export async function DELETE(request: NextRequest, props: { params: Params }) {
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "settings", "write");
    const rateKey = `api_keys:${teamId}`;
    const rateResult = await rateLimit(rateKey, RATE_LIMIT_CONFIGS.API_KEYS);
    if (!rateResult.allowed) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    }
    const { id } = await props.params;

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
