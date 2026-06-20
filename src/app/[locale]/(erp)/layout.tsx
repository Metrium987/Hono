import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { ErpSidebar } from "./erp-sidebar";
import { ErpHeader } from "./erp-header";
import { redirect } from "next/navigation";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, teams:team_id(name)")
    .limit(1)
    .single();

  if (!memberships) redirect("/onboarding");

  const activeTeam = memberships as {
    team_id: string;
    teams: { name: string } | { name: string }[];
  };
  const teamId = activeTeam.team_id;
  const teamName = Array.isArray(activeTeam.teams)
    ? (activeTeam.teams[0]?.name ?? "Mon Entreprise")
    : (activeTeam.teams?.name ?? "Mon Entreprise");
  const userEmail = user.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden">
      <ErpSidebar teamName={teamName} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ErpHeader
          userEmail={userEmail}
          teamName={teamName}
          teamId={teamId}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
