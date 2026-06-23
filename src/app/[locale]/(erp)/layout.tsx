import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { ErpSidebar } from "./erp-sidebar";
import { ErpHeader } from "./erp-header";
import { Toaster } from "@/components/ui/sonner";
import { redirect } from "next/navigation";

export default async function ErpLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, is_owner, role_id, teams:team_id(name)")
    .limit(1)
    .single();

  if (!memberships) redirect(`/${locale}/onboarding`);

  const activeTeam = memberships as {
    team_id: string;
    is_owner: boolean;
    role_id: string | null;
    teams: { name: string } | { name: string }[];
  };
  const teamId = activeTeam.team_id;
  const teamName = Array.isArray(activeTeam.teams)
    ? (activeTeam.teams[0]?.name ?? "Mon Entreprise")
    : (activeTeam.teams?.name ?? "Mon Entreprise");
  const userEmail = user.email ?? "";

  let userPermissions: Record<string, string[]> | null = null;
  const isOwner = activeTeam.is_owner;

  if (activeTeam.role_id) {
    const { data: role } = await supabase
      .from("team_roles")
      .select("permissions")
      .eq("id", activeTeam.role_id)
      .single();
    if (role?.permissions) {
      userPermissions = role.permissions as Record<string, string[]>;
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex shrink-0">
        <ErpSidebar
          teamName={teamName}
          permissions={userPermissions}
          isOwner={isOwner}
        />
      </div>

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <ErpHeader
          userEmail={userEmail}
          teamName={teamName}
          teamId={teamId}
          locale={locale}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 sm:p-6"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
