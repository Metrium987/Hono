import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type PagePermissionResult = {
  allowed: boolean;
  isOwner: boolean;
  teamId: string;
  permissions: Record<string, string[]> | null;
};

/**
 * Vérifie si l'utilisateur connecté a la permission d'accéder à une page.
 * À appeler au début de chaque page ERP côté serveur.
 *
 * Usage:
 *   const { allowed } = await checkPagePermission("income", "read");
 *   if (!allowed) return <ForbiddenPage module="income" />;
 */
export async function checkPagePermission(
  module: string,
  action: "read" | "write" = "read"
): Promise<PagePermissionResult> {
  const result: PagePermissionResult = {
    allowed: false,
    isOwner: false,
    teamId: "",
    permissions: null,
  };

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return result;

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, is_owner, role_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return result;

  result.teamId = membership.team_id ?? "";
  result.isOwner = membership.is_owner;

  // Owners bypass all checks
  if (membership.is_owner) {
    result.allowed = true;
    return result;
  }

  // Fetch role permissions
  if (membership.role_id) {
    const { data: role } = await supabase
      .from("team_roles")
      .select("permissions")
      .eq("id", membership.role_id)
      .single();

    if (role?.permissions) {
      result.permissions = role.permissions as Record<string, string[]>;
    }
  }

  // Check the specific permission
  const perms = result.permissions?.[module];
  result.allowed = Array.isArray(perms) && perms.includes(action);

  return result;
}
