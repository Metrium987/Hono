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
    async function check() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setResult({ allowed: false, isOwner: false, teamId: null, loading: false });
          return;
        }

        const meta = session.user.app_metadata as Record<string, unknown> | undefined;
        const teamId = (meta?.team_id as string) ?? null;
        const isOwner = (meta?.is_owner as boolean) ?? false;
        const permissions = (meta?.permissions as Record<string, string[]> | undefined) ?? defaultPermissions;

        const allowed = isOwner || (permissions[module]?.includes(action) ?? false);

        setResult({ allowed, isOwner, teamId, loading: false });
      } catch {
        setResult({ allowed: false, isOwner: false, teamId: null, loading: false });
      }
    }
    check();
  }, [module, action]);

  return result;
}
