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
  Percent,
  Trophy,
  Activity,
  CalendarDays,
  KanbanSquare,
  RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

type NavItem = {
  key: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  sectionKey: string;
  items: NavItem[];
};

// Map each nav item key to its RBAC permission module.
// Items not listed (or set to null) are visible to everyone.
const ITEM_MODULES: Record<string, string | null> = {
  invoices: "invoices",
  quotes: "quotes",
  credit_notes: "invoices",
  orders: "orders",
  recurring_invoices: "invoices",
  clients: "clients",
  crm_board: "clients",
  reminders: "clients",
  products: "catalog",
  categories: "catalog",
  promotions: "catalog",
  expenses: "expenses",
  income: "income",
  vendors: "clients",
  treasury: "reports",
  revenue_book: "reports",
  break_even: "reports",
  calendar: "clients",
  my_activity: null, // always visible
  team_performance: "reports",
  reports: "reports",
  settings: "settings",
};

const NAV_GROUPS: NavGroup[] = [
  {
    sectionKey: "commerce_section",
    items: [
      { key: "invoices",           href: "/invoices",           icon: FileText },
      { key: "quotes",             href: "/quotes",             icon: FileSignature },
      { key: "credit_notes",       href: "/credit-notes",       icon: Receipt },
      { key: "orders",             href: "/orders",             icon: ShoppingCart },
      { key: "recurring_invoices", href: "/recurring-invoices", icon: RefreshCw },
    ],
  },
  {
    sectionKey: "crm_section",
    items: [
      { key: "clients",   href: "/customers", icon: Users },
      { key: "crm_board", href: "/crm-board", icon: KanbanSquare },
      { key: "reminders", href: "/reminders", icon: Bell },
    ],
  },
  {
    sectionKey: "catalog_section",
    items: [
      { key: "products",    href: "/catalog",             icon: Package },
      { key: "categories",  href: "/catalog/categories",  icon: Tag },
      { key: "promotions",  href: "/promotions",          icon: Percent },
    ],
  },
  {
    sectionKey: "finance_section",
    items: [
      { key: "expenses",     href: "/expenses",     icon: TrendingDown },
      { key: "income",       href: "/income",       icon: TrendingUp },
      { key: "vendors",      href: "/vendors",      icon: Truck },
      { key: "treasury",     href: "/treasury",     icon: Wallet },
      { key: "revenue_book", href: "/revenue-book", icon: BookOpen },
      { key: "break_even",   href: "/break-even",   icon: Target },
    ],
  },
  {
    sectionKey: "team_section",
    items: [
      { key: "calendar",        href: "/calendar",         icon: CalendarDays },
      { key: "my_activity",     href: "/my-activity",      icon: Activity },
      { key: "team_performance", href: "/team-performance", icon: Trophy },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { key: "reports",  href: "/reports",  icon: BarChart3 },
  { key: "settings", href: "/settings", icon: Settings },
];

type ErpSidebarProps = {
  teamName: string;
  permissions: Record<string, string[]> | null;
  isOwner: boolean;
};

function hasModuleAccess(
  permissions: Record<string, string[]> | null,
  isOwner: boolean,
  module: string | null
): boolean {
  if (module === null) return true; // no restriction
  if (isOwner) return true; // owner bypass
  if (!permissions) return false;
  const perms = permissions[module];
  return Array.isArray(perms) && perms.includes("read");
}

export function ErpSidebar({ teamName, permissions, isOwner }: ErpSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);

  const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "fr";
  const relativePath = pathname.replace(/^\/[a-z]{2}/, "");

  // Filter nav groups based on RBAC permissions
  const filteredGroups = useMemo(() => {
    return NAV_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          hasModuleAccess(permissions, isOwner, ITEM_MODULES[item.key] ?? null)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [permissions, isOwner]);

  const filteredBottom = useMemo(
    () =>
      BOTTOM_ITEMS.filter((item) =>
        hasModuleAccess(permissions, isOwner, ITEM_MODULES[item.key] ?? null)
      ),
    [permissions, isOwner]
  );

  function NavLink({ href, icon: Icon, labelKey }: { href: string; icon: React.ElementType; labelKey: string }) {
    const isActive = relativePath === href || (href !== "/" && relativePath.startsWith(href));
    return (
      <Link
        href={`/${locale}${href}`}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{t(labelKey)}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-200",
        collapsed ? "w-[52px]" : "w-56"
      )}
    >
      {/* Brand */}
      <div className="flex h-13 items-center gap-2.5 border-b px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold tracking-tight">
          H
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold truncate">{teamName}</span>
        )}
      </div>

      {/* Groups — filtré par permissions RBAC */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {filteredGroups.map((group) => (
          <div key={group.sectionKey}>
            {!collapsed && (
              <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {t(group.sectionKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} href={item.href} icon={item.icon} labelKey={item.key} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — reports + settings (filtré) */}
      {filteredBottom.length > 0 && (
        <div className="border-t px-2 py-2 space-y-0.5">
          {filteredBottom.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} labelKey={item.key} />
          ))}
        </div>
      )}

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 justify-center text-muted-foreground hover:text-foreground"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
        </Button>
      </div>
    </aside>
  );
}
