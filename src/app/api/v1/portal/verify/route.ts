import { NextRequest, NextResponse } from "next/server";

// POST /api/v1/portal/verify — Deprecated
// Portal now uses Supabase Auth magic links. The old custom token flow is replaced.
// Users should receive Supabase-generated magic links and go through /auth/callback.
export async function POST(_request: NextRequest) {
  return NextResponse.json({
    error: "This endpoint is deprecated. Please use the new magic link flow.",
  }, { status: 410 });
}
