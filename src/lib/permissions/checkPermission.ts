import { createClient as createServerClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

/**
 * Module names for RBAC permission checking.
 * Maps to the JSONB keys in team_roles.permissions.
 */
export type PermissionModule =
  | "catalog"
  | "clients"
  | "quotes"
  | "invoices"
  | "orders"
  | "expenses"
  | "income"
  | "reports"
  | "currencies"
  | "taxes"
  | "payments"
  | "settings";

/**
 * Actions that can be checked against a module.
 */
export type PermissionAction = "read" | "write";

/**
 * Check if a user has a specific permission on a module within a team.
 * This is the server-side enforcement layer (Layer 2).
 *
 * @param userId - The authenticated user's UUID
 * @param teamId - The team context UUID
 * @param module - The module to check (e.g., "catalog", "invoices")
 * @param action - The action to check ("read" or "write")
 * @returns true if the user has the permission or is an owner
 */
export async function checkPermission(
  userId: string,
  teamId: string,
  module: PermissionModule,
  action: PermissionAction
): Promise<boolean> {
  // Owner bypass: is_owner = true means full access
  // The RPC function handles this check on the database side

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const { data, error } = await supabase.rpc("check_permission", {
    p_user_id: userId,
    p_team_id: teamId,
    p_module: module,
    p_action: action,
  });

  if (error) {
    console.error("checkPermission RPC error:", error.message);
    return false;
  }

  return data === true;
}

/**
 * Check if a user is an owner of a team.
 * Owners bypass all permission checks.
 */
export async function isTeamOwner(
  userId: string,
  teamId: string
): Promise<boolean> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const { data, error } = await supabase
    .from("team_members")
    .select("is_owner")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return false;
  return data.is_owner === true;
}

/**
 * Get the user's role name within a team.
 */
export async function getUserRoleName(
  userId: string,
  teamId: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const { data, error } = await supabase
    .from("team_members")
    .select("team_roles(name)")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;
  // @ts-expect-error - Supabase join types need explicit typing
  return data.team_roles?.name ?? null;
}
