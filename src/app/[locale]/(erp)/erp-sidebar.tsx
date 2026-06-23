"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  FileText, FileSignature, Receipt, ShoppingCart, RefreshCw,
  Users, KanbanSquare, CalendarDays, Bell,
  Package, Tag, Layers, Percent, Upload,
  PackageCheck, Warehouse, ClipboardList, Box,
  TrendingDown, TrendingUp, Truck, CreditCard, DollarSign, Banknote,
  Wallet, BookOpen, Target,
  Activity, Trophy, AlertTriangle, CheckSquare,
  BarChart3, Settings, Store, Plug, ChevronLeft,
} from "lucide-react";
import { useState, useMemo } from "react";

type NavItem  = { key: string; href: string; icon: React.ElementType };
type NavGroup = { sectionKey: string; items: NavItem[] };

/* ─── Permission map ─────────────────────────────────────────────────────── */
const ITEM_MODULES: Record<string, string | null> = {
  invoices:           "invoices",
  quotes:             "quotes",
  orders:             "orders",
  credit_notes:       "credit_notes",
  recurring_invoices: "invoices",
  clients:            "clients",
  crm_board:          "crm",
  calendar:           "calendar",
  reminders:          "reminders",
  products:           "catalog",
  categories:         "catalog",
  brands:             "catalog",
  promotions:         "promotions",
  catalog_import:     "catalog",
  delivery_notes:     "orders",
  warehouses:         "inventory",
  inventory_counts:   "inventory",
  containers:         "inventory",
  expenses:           "expenses",
  income:             "income",
  vendors:            "clients",
  receivables:        "finance",
  vendor_commissions: "finance",
  cash_closures:      "finance",
  treasury:           "reports",
  revenue_book:       "reports",
  break_even:         "reports",
  my_activity:        null,
  team_performance:   "reports",
  alerts:             "governance",
  approvals:          "governance",
  marketplace:        "marketplace",
  integrations:       "integrations",
  reports:            "reports",
  settings:           "settings",
};

/* ─── Navigation structure ───────────────────────────────────────────────── */
/*
 * Logique métier pour un ERP PF :
 * 1. FACTURATION   — le flux documentaire principal (devis → commande → facture)
 * 2. CRM & AGENDA  — gestion des relations client (clients, pipeline, agenda, relances)
 * 3. CATALOGUE     — référentiel produits et tarification
 * 4. LOGISTIQUE    — flux physique (livraisons, entrepôts, stock)
 * 5. FINANCE       — flux financiers (dépenses, recettes, trésorerie)
 * 6. ÉQUIPE        — activité interne, gouvernance, alertes
 *
 * En bas (toujours visibles) : rapports globaux + paramètres
 * Marketplace/Intégrations : section technique bottom
 */
const NAV_GROUPS: NavGroup[] = [
  {
    sectionKey: "commerce_section", // label → "Facturation"
    items: [
      { key: "invoices",           href: "/invoices",           icon: FileText },
      { key: "quotes",             href: "/quotes",             icon: FileSignature },
      { key: "orders",             href: "/orders",             icon: ShoppingCart },
      { key: "credit_notes",       href: "/credit-notes",       icon: Receipt },
      { key: "recurring_invoices", href: "/recurring-invoices", icon: RefreshCw },
    ],
  },
  {
    sectionKey: "crm_section", // label → "CRM & Agenda"
    items: [
      { key: "clients",   href: "/customers", icon: Users },
      { key: "crm_board", href: "/crm-board", icon: KanbanSquare },
      { key: "calendar",  href: "/calendar",  icon: CalendarDays },
      { key: "reminders", href: "/reminders", icon: Bell },
    ],
  },
  {
    sectionKey: "catalog_section",
    items: [
      { key: "products",       href: "/catalog",            icon: Package },
      { key: "categories",     href: "/catalog/categories", icon: Tag },
      { key: "brands",         href: "/catalog/brands",     icon: Layers },
      { key: "promotions",     href: "/promotions",         icon: Percent },
      { key: "catalog_import", href: "/catalog/import",     icon: Upload },
    ],
  },
  {
    sectionKey: "logistics_section",
    items: [
      { key: "delivery_notes",  href: "/delivery-notes",  icon: PackageCheck },
      { key: "warehouses",      href: "/warehouses",      icon: Warehouse },
      { key: "inventory_counts",href: "/inventory-counts",icon: ClipboardList },
      { key: "containers",      href: "/containers",      icon: Box },
    ],
  },
  {
    sectionKey: "finance_section",
    items: [
      { key: "expenses",           href: "/expenses",              icon: TrendingDown },
      { key: "income",             href: "/income",                icon: TrendingUp },
      { key: "vendors",            href: "/vendors",               icon: Truck },
      { key: "receivables",        href: "/finance/receivables",   icon: CreditCard },
      { key: "vendor_commissions", href: "/vendor-commissions",    icon: DollarSign },
      { key: "cash_closures",      href: "/finance/cash-closures", icon: Banknote },
      { key: "treasury",           href: "/treasury",              icon: Wallet },
      { key: "revenue_book",       href: "/revenue-book",          icon: BookOpen },
      { key: "break_even",         href: "/break-even",            icon: Target },
    ],
  },
  {
    sectionKey: "team_section",
    items: [
      { key: "my_activity",      href: "/my-activity",      icon: Activity },
      { key: "team_performance", href: "/team-performance", icon: Trophy },
      { key: "alerts",           href: "/alerts",           icon: AlertTriangle },
      { key: "approvals",        href: "/approvals",        icon: CheckSquare },
    ],
  },
];

const BOTTOM_ITEMS: NavItem[] = [
  { key: "marketplace",  href: "/marketplace",  icon: Store },
  { key: "integrations", href: "/integrations", icon: Plug },
  { key: "reports",      href: "/reports",      icon: BarChart3 },
  { key: "settings",     href: "/settings",     icon: Settings },
];

/* ─── Types ──────────────────────────────────────────────────────────────── */
type ErpSidebarProps = {
  teamName: string;
  permissions: Record<string, string[]> | null;
  isOwner: boolean;
};

function hasAccess(
  permissions: Record<string, string[]> | null,
  isOwner: boolean,
  module: string | null
): boolean {
  if (module === null) return true;
  if (isOwner) return true;
  if (!permissions) return false;
  return Array.isArray(permissions[module]) && permissions[module].includes("read");
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export function ErpSidebar({ teamName, permissions, isOwner }: ErpSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);

  const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "fr";
  const relativePath = pathname.replace(/^\/[a-z]{2}/, "");

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS
        .map((g) => ({
          ...g,
          items: g.items.filter((item) =>
            hasAccess(permissions, isOwner, ITEM_MODULES[item.key] ?? null)
          ),
        }))
        .filter((g) => g.items.length > 0),
    [permissions, isOwner]
  );

  const visibleBottom = useMemo(
    () =>
      BOTTOM_ITEMS.filter((item) =>
        hasAccess(permissions, isOwner, ITEM_MODULES[item.key] ?? null)
      ),
    [permissions, isOwner]
  );

  function NavLink({ href, icon: Icon, labelKey }: {
    href: string;
    icon: React.ElementType;
    labelKey: string;
  }) {
    const isActive =
      relativePath === href ||
      (href !== "/" && relativePath.startsWith(href));

    return (
      <Link
        href={`/${locale}${href}`}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px]",
          "text-[13px] font-medium leading-snug select-none",
          "transition-colors duration-150 ease-out",
          "min-h-[32px]",          // accessible touch target height
          isActive
            ? "bg-primary/[0.08] text-primary dark:bg-primary/[0.16]"
            : [
                "text-foreground/65 dark:text-white/55",
                "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                "hover:text-foreground dark:hover:text-white",
              ].join(" ")
        )}
        title={collapsed ? t(labelKey) : undefined}
      >
        <Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0",
            isActive
              ? "text-primary"
              : "text-foreground/35 dark:text-white/35 group-hover:text-foreground/60"
          )}
          aria-hidden="true"
        />
        {!collapsed && (
          <span className="truncate">{t(labelKey)}</span>
        )}
      </Link>
    );
  }

  return (
    <aside
      role="navigation"
      aria-label="Navigation principale"
      style={{
        width: collapsed ? 56 : 220,
        transition: "width 200ms cubic-bezier(0.4,0,0.2,1)",
      }}
      className={cn(
        "flex flex-col shrink-0 overflow-hidden",
        /* macOS sidebar: frosted white en clair, profond en sombre */
        "bg-[rgba(246,246,250,0.92)] dark:bg-[#1C1C1E]",
        "supports-[backdrop-filter]:bg-[rgba(246,246,250,0.78)] dark:supports-[backdrop-filter]:bg-[rgba(28,28,30,0.82)]",
        "supports-[backdrop-filter]:backdrop-blur-xl",
        "border-r border-black/[0.07] dark:border-white/[0.07]",
      )}
    >
      {/* ── Brand / Team ───────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center h-12 shrink-0",
          "border-b border-black/[0.06] dark:border-white/[0.06]",
          collapsed ? "justify-center" : "gap-2.5 px-4"
        )}
      >
        <div
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center
                     rounded-[7px] bg-primary text-primary-foreground
                     text-[11px] font-bold tracking-tight select-none"
          aria-hidden="true"
        >
          H
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold tracking-tight truncate text-foreground">
            {teamName}
          </span>
        )}
      </div>

      {/* ── Main navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2.5 px-2 space-y-3">
        {visibleGroups.map((group) => (
          <div key={group.sectionKey}>
            {!collapsed && (
              <p className="px-2.5 mb-1 text-[11px] font-medium text-foreground/40 dark:text-white/35">
                {t(group.sectionKey)}
              </p>
            )}
            {collapsed && (
              <div className="h-px mx-1.5 bg-black/[0.06] dark:bg-white/[0.06] mb-1" aria-hidden="true" />
            )}
            <div className="space-y-px">
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  labelKey={item.key}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Bottom fixed items (reports / settings / integrations) ──────── */}
      {visibleBottom.length > 0 && (
        <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] px-2 py-2 space-y-px">
          {visibleBottom.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              labelKey={item.key}
            />
          ))}
        </div>
      )}

      {/* ── Collapse toggle ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.06] p-1.5">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full items-center justify-center rounded-[8px]",
            "h-8 min-h-[32px]",   // accessible touch target
            "text-foreground/30 hover:text-foreground/55",
            "dark:text-white/20 dark:hover:text-white/45",
            "hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
            "transition-colors duration-150"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 ease-out",
              collapsed && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
