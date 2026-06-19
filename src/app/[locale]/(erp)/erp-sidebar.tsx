"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText,
  FileSignature,
  Package,
  Users,
  BarChart3,
  Settings,
  Receipt,
  ChevronLeft,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const mainNav = [
  { label: "Factures", href: "/invoices", icon: FileText },
  { label: "Devis", href: "/quotes", icon: FileSignature },
  { label: "Avoirs", href: "/credit-notes", icon: Receipt },
  { label: "Produits", href: "/products", icon: Package },
  { label: "Clients", href: "/customers", icon: Users },
];

const financeNav = [
  { label: "Dépenses", href: "/expenses", icon: TrendingDown },
  { label: "Revenus", href: "/income", icon: TrendingUp },
  { label: "Fournisseurs", href: "/vendors", icon: Truck },
];

const bottomNav = [
  { label: "Rapports", href: "/reports", icon: BarChart3 },
  { label: "Paramètres", href: "/settings", icon: Settings },
];

export function ErpSidebar({ teamName }: { teamName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Extract locale prefix from pathname (/fr/invoices → fr, for matching)
  const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "fr";
  const relativePath = pathname.replace(/^\/[a-z]{2}/, "");

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
          H
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold truncate">{teamName}</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        {/* Main */}
        <div className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = relativePath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {!collapsed && <Separator className="my-2" />}

        {/* Finance */}
        {!collapsed && <p className="px-3 text-xs font-medium text-muted-foreground">Finance</p>}
        <div className="space-y-1">
          {financeNav.map((item) => {
            const Icon = item.icon;
            const isActive = relativePath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {!collapsed && <Separator className="my-2" />}

        {/* Bottom */}
        <div className="space-y-1">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const isActive = relativePath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Collapse button */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>
    </aside>
  );
}
