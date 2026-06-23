"use client";

import { LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch } from "@/components/erp/global-search";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type ErpHeaderProps = {
  userEmail: string;
  teamName: string;
  teamId: string;
  locale: string;
};

function getInitials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/* Avatar couleur déterministe selon initiales */
function avatarHue(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) % 360;
  return h;
}

export function ErpHeader({ userEmail, teamName, teamId, locale }: ErpHeaderProps) {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = `/${locale}/login`;
  }

  const initials = getInitials(userEmail);
  const hue = avatarHue(userEmail);

  return (
    <header
      className={[
        "flex h-12 shrink-0 items-center justify-between px-4",
        /* Use token instead of hardcoded white/1C1C1E */
        "bg-[color-mix(in_srgb,var(--color-background)_85%,transparent)]",
        "supports-[backdrop-filter]:backdrop-blur-xl",
        "supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--color-background)_72%,transparent)]",
        "border-b border-black/[0.06] dark:border-white/[0.07]",
        "sticky top-0 z-30",
      ].join(" ")}
      role="banner"
    >
      {/* Left — team context */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-medium text-foreground/45 dark:text-white/40 truncate select-none hidden sm:block">
          {teamName}
        </span>
      </div>

      {/* Right — search + user */}
      <div className="flex items-center gap-1.5">
        <GlobalSearch teamId={teamId} locale={locale} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Compte utilisateur — ${userEmail}`}
              className={[
                "flex items-center gap-2 rounded-[8px] px-2 py-1.5 h-9",
                "text-sm font-medium",
                "transition-colors duration-150 ease-out",
                "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              ].join(" ")}
            >
              {/* Colour-keyed avatar */}
              <div
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `oklch(0.65 0.14 ${hue})`,
                  color: "oklch(0.985 0 0)",
                }}
                aria-hidden="true"
              >
                <span className="text-[10px] font-bold leading-none">{initials}</span>
              </div>
              <span className="text-[13px] hidden md:inline text-foreground/65 dark:text-white/55 truncate max-w-[140px]">
                {userEmail}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-[13px] font-semibold">Mon compte</DropdownMenuLabel>
            <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal pb-1 pt-0">
              {userEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-[13px] cursor-pointer gap-2">
              <Link href={`/${locale}/settings`}>
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive text-[13px] cursor-pointer gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
