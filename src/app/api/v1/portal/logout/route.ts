import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// POST /api/v1/portal/logout — Sign out from Supabase Auth and redirect
export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut();

  // Redirect to portal auth page
  const referer = _request.headers.get("referer") ?? "";
  const localeMatch = referer.match(/\/([a-z]{2})\//);
  const locale = localeMatch?.[1] ?? "fr";

  const redirectUrl = `/${locale}/portal/auth`;
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
