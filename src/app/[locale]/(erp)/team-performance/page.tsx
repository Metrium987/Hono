import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { TeamPerformanceClient, type StaffMember, type CommissionRule, type CommissionRow, type StaffPerf } from "./team-performance-client";

export default async function TeamPerformancePage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: memberships } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>Aucune équipe</div>;

  const admin = createAdminClient();
  const [{ data: teamMembers }, { data: { users: authUsers } }, { data: rules }, { data: commissions }] = await Promise.all([
    admin.from("team_members").select("user_id, role_name, is_owner").eq("team_id", teamId),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("commission_rules").select("*").eq("team_id", teamId).order("applies_from", { ascending: false }),
    supabase.from("invoice_commissions")
      .select(`*, invoice:invoice_id(number, total_ttc, customer:customer_id(contact_name))`)
      .eq("team_id", teamId).order("created_at", { ascending: false }),
  ]);

  // Build staff members list
  const userMap = new Map(authUsers.map((u) => [u.id, u]));
  const members: StaffMember[] = (teamMembers ?? []).map((m) => {
    const u = userMap.get(m.user_id);
    return { id: m.user_id, name: (u?.user_metadata?.full_name as string) ?? u?.email ?? m.user_id, email: u?.email ?? null, role_name: m.role_name };
  });

  // Fetch paid invoices with assigned_to for CA stats
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, assigned_to, total_ttc, status")
    .eq("team_id", teamId)
    .in("status", ["paid"])
    .not("assigned_to", "is", null);

  // Build perf per member
  const commissionRows = (commissions ?? []) as CommissionRow[];
  const invoiceRows = invoices ?? [];
  const commRules = (rules ?? []) as CommissionRule[];

  const staffPerfs: StaffPerf[] = members.map((member) => {
    const myInvoices = invoiceRows.filter((inv) => inv.assigned_to === member.id);
    const myCommissions = commissionRows.filter((c) => c.user_id === member.id);
    const myRules = commRules.filter((r) => r.user_id === member.id);
    return {
      member,
      invoiceCount: myInvoices.length,
      caTtc: myInvoices.reduce((sum, inv) => sum + parseFloat(String(inv.total_ttc || 0)), 0),
      pendingCommission: myCommissions.filter((c) => c.status === "pending").reduce((s, c) => s + parseFloat(String(c.amount)), 0),
      paidCommission: myCommissions.filter((c) => c.status === "paid").reduce((s, c) => s + parseFloat(String(c.amount)), 0),
      commissions: myCommissions,
      rules: myRules,
    };
  }).sort((a, b) => b.caTtc - a.caTtc);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance équipe</h1>
        <p className="text-sm text-muted-foreground">CA et commissions par commercial</p>
      </div>
      <TeamPerformanceClient staffPerfs={staffPerfs} rules={commRules} members={members} teamId={teamId} />
    </div>
  );
}
