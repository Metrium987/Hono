import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";

const DEFAULT_TEAM_ID = process.env.NEXT_PUBLIC_DEFAULT_TEAM_ID ?? "";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/fr/login?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/fr/login?error=auth_callback_error`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/fr/login?error=no_user`);
  }

  // 1. Staff ERP → team_members
  const { data: member } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (member) {
    return NextResponse.redirect(`${origin}/fr/invoices`);
  }

  // 2. Client existant → portal_users
  const { data: portalUser } = await supabase
    .from("portal_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .limit(1)
    .single();

  if (portalUser) {
    return NextResponse.redirect(`${origin}/fr/portal/dashboard`);
  }

  // 3. Nouveau client → auto-création customer + portal_user
  if (!DEFAULT_TEAM_ID) {
    return NextResponse.redirect(`${origin}/fr/login?error=no_team_configured`);
  }

  try {
    const adminSupabase = createAdminClient();
    const email = user.email ?? "";
    const name = user.user_metadata?.full_name ?? email.split("@")[0];

    // Créer le customer
    const { data: newCustomer, error: customerError } = await adminSupabase
      .from("customers")
      .insert({
        team_id: DEFAULT_TEAM_ID,
        contact_name: name,
        email,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (customerError || !newCustomer) {
      console.error("Failed to create customer on signup:", customerError);
      return NextResponse.redirect(`${origin}/fr/portal/dashboard`);
    }

    // Créer le portal_user
    await adminSupabase
      .from("portal_users")
      .insert({
        customer_id: newCustomer.id,
        auth_user_id: user.id,
        email,
        name,
      });

    return NextResponse.redirect(`${origin}/fr/portal/dashboard`);
  } catch (err) {
    console.error("Auto-create portal user error:", err);
    return NextResponse.redirect(`${origin}/fr/portal/dashboard`);
  }
}
