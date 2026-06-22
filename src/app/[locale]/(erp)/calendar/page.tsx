import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { CalendarClient, type StaffGroup, type CustomerOption } from "./calendar-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ customer_id?: string }>;

export default async function CalendarPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const perm = await checkPagePermission("calendar", "read");
  if (!perm.allowed) return <ForbiddenPage module="calendar" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const admin = createAdminClient();

  const [eventsRes, groupsRes, customersRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*, customer:customer_id(contact_name, company_name), group:group_id(name, color)")
      .eq("team_id", teamId)
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd)
      .order("starts_at"),
    admin
      .from("staff_groups")
      .select("*, member_count:staff_group_members(count)")
      .eq("team_id", teamId)
      .order("name"),
    supabase
      .from("customers")
      .select("id, contact_name, company_name")
      .eq("team_id", teamId)
      .order("company_name"),
  ]);

  const groups: StaffGroup[] = (groupsRes.data ?? []).map((g: Record<string, unknown>) => ({
    id: g.id as string,
    name: g.name as string,
    color: g.color as string,
    description: (g.description as string | null) ?? null,
    member_count: (g.member_count as Array<{ count: number }>)?.[0]?.count ?? 0,
  }));

  const customers: CustomerOption[] = (customersRes.data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    contact_name: c.contact_name as string,
    company_name: (c.company_name as string | null) ?? null,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">Planifiez vos réunions, appels et tâches</p>
      </div>

      <CalendarClient
        initialEvents={eventsRes.data ?? []}
        groups={groups}
        customers={customers}
        teamId={teamId}
        prefilledCustomerId={searchParams.customer_id}
      />
    </div>
  );
}
