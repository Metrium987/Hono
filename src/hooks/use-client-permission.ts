"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export type PermissionResult = {
  allowed: boolean;
  isOwner: boolean;
  teamId: string | null;
  loading: boolean;
};

const defaultPermissions: Record<string, string[]> = {};

export function useClientPermission(
  module: string,
  action: "read" | "write" = "read"
): PermissionResult {
  const [result, setResult] = useState<PermissionResult>({
    allowed: false,
    isOwner: false,
    teamId: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (!cancelled) setResult({ allowed: false, isOwner: false, teamId: null, loading: false });
          return;
        }

        const meta = session.user.app_metadata as Record<string, unknown> | undefined;
        const jwtIsOwner = (meta?.is_owner as boolean) ?? false;
        const jwtPermissions = (meta?.permissions as Record<string, string[]> | undefined) ?? defaultPermissions;
        const jwtTeamId = (meta?.team_id as string) ?? null;

        // If JWT has valid claims, use them immediately
        if (jwtIsOwner || jwtTeamId) {
          const allowed = jwtIsOwner || (jwtPermissions[module]?.includes(action) ?? false);
          if (!cancelled) setResult({ allowed, isOwner: jwtIsOwner, teamId: jwtTeamId, loading: false });
          return;
        }

        // Fallback: query DB directly — JWT claims are stale or missing
        const { data: member } = await supabase
          .from("team_members")
          .select("team_id, is_owner, role_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        if (!member) {
          if (!cancelled) setResult({ allowed: false, isOwner: false, teamId: null, loading: false });
          return;
        }

        const dbTeamId = member.team_id;
        const dbIsOwner = member.is_owner;

        if (dbIsOwner) {
          if (!cancelled) setResult({ allowed: true, isOwner: true, teamId: dbTeamId, loading: false });
          return;
        }

        // Fetch role permissions from DB
        let dbPermissions = defaultPermissions;
        if (member.role_id) {
          const { data: role } = await supabase
            .from("team_roles")
            .select("permissions")
            .eq("id", member.role_id)
            .maybeSingle();

          if (role?.permissions) {
            dbPermissions = role.permissions as Record<string, string[]>;
          }
        }

        const allowed = dbPermissions[module]?.includes(action) ?? false;
        if (!cancelled) setResult({ allowed, isOwner: false, teamId: dbTeamId, loading: false });
      } catch {
        if (!cancelled) setResult({ allowed: false, isOwner: false, teamId: null, loading: false });
      }
    }
    check();

    return () => { cancelled = true; };
  }, [module, action]);

  return result;
}
