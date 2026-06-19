import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { encryptSession } from "@/lib/portal/session";

// POST /api/v1/portal/verify — Verify a magic link token and create session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Find and validate the token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("portal_login_tokens")
      .select("id, portal_user_id, expires_at, used_at, portal_user:portal_user_id!inner(id, customer_id, email, name, customer:customer_id!inner(team_id))")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRecord) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check expiry
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // Check if already used
    if (tokenRecord.used_at) {
      return NextResponse.json({ error: "Token already used" }, { status: 401 });
    }

    // Mark token as used
    await supabase
      .from("portal_login_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Extract portal user info
    const portalUser = Array.isArray(tokenRecord.portal_user)
      ? tokenRecord.portal_user[0]
      : tokenRecord.portal_user;

    const customer = Array.isArray(portalUser.customer)
      ? portalUser.customer[0]
      : portalUser.customer;

    const teamId = customer.team_id;

    // Create encrypted session cookie
    const session = {
      portalUserId: portalUser.id,
      customerId: portalUser.customer_id,
      email: portalUser.email,
      name: portalUser.name,
      teamId,
    };

    const encrypted = encryptSession(session);

    // Return success with session cookie
    const response = NextResponse.json({
      success: true,
      portalUser: {
        id: portalUser.id,
        email: portalUser.email,
        name: portalUser.name,
        customerId: portalUser.customer_id,
      },
    });

    response.headers.append(
      "Set-Cookie",
      `hono_portal=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`
    );

    return response;
  } catch (err) {
    console.error("Portal verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
