"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  ShoppingCart,
  Tag,
  Bell,
  Wallet,
  BookOpen,
  Target,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const mainNavItems = [
  { key: "invoices" as const,     href: "/invoices",     icon: FileText },
  { key: "quotes" as const,       href: "/quotes",       icon: FileSignature },
  { key: "credit_notes" as const, href: "/credit-notes", icon: Receipt },
  { key: "orders" as const,       href: "/orders",       icon: ShoppingCart },
  { key: "reminders" as const,   href: "/reminders",   icon: Bell },
  { key: "products" as const,     href: "/catalog",             icon: Package },
  { key: "categories" as const,  href: "/catalog/categories",  icon: Tag },
  { key: "clients" as const,     href: "/customers",           icon: Users },
];

const financeNavItems = [
  { key: "expenses" as const,     href: "/expenses",     icon: TrendingDown },
  { key: "income" as const,       href: "/income",       icon: TrendingUp },
  { key: "vendors" as const,      href: "/vendors",      icon: Truck },
  { key: "treasury" as const,     href: "/treasury",     icon: Wallet },
  { key: "revenue_book" as const, href: "/revenue-book", icon: BookOpen },
  { key: "break_even" as const,   href: "/break-even",   icon: Target },
];

const bottomNavItems = [
  { key: "reports" as const,  href: "/reports",  icon: BarChart3 },
  { key: "settings" as const, href: "/settings", icon: Settings },
];

export function ErpSidebar({ teamName }: { teamName: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);

  const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "fr";
  const relativePath = pathname.replace(/^\/[a-z]{2}/, "");

  function NavLink({ href, icon: Icon, labelKey }: { href: string; icon: React.ElementType; labelKey: string }) {
    const isActive = relativePath.startsWith(href);
    return (
      <Link
        href={`/${locale}${href}`}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t(labelKey)}</span>}
      </Link>
    );
  }

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
        <div className="space-y-1">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} labelKey={item.key} />
          ))}
        </div>

        {!collapsed && <Separator className="my-2" />}

        {!collapsed && <p className="px-3 text-xs font-medium text-muted-foreground">{t("finance_section")}</p>}
        <div className="space-y-1">
          {financeNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} labelKey={item.key} />
          ))}
        </div>

        {!collapsed && <Separator className="my-2" />}

        <div className="space-y-1">
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} labelKey={item.key} />
          ))}
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
