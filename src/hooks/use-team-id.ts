"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useTeamId(): string | null {
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        const tid = (session?.user?.app_metadata as Record<string, unknown> | undefined)?.team_id as string | undefined;
        if (tid) setTeamId(tid);
      });
  }, []);

  return teamId;
}
