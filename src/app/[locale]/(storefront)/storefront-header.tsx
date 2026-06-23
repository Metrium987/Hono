"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingCart, User, Menu, X, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart/cart-context";

export function StorefrontHeader({
  isPortalLoggedIn = false,
  portalCustomerName = null,
}: {
  isPortalLoggedIn?: boolean;
  portalCustomerName?: string | null;
}) {
  const t = useTranslations("storefront");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: t("home"), href: "/" },
    { label: t("catalog"), href: "/products" },
    { label: t("contact"), href: "/contact" },
    ...(isPortalLoggedIn
      ? [{ label: t("my_space"), href: "/portal/dashboard" }]
      : []),
  ];
  const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] ?? "fr";
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-[color-mix(in_srgb,var(--color-background)_88%,transparent)] supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--color-background)_75%,transparent)] supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-primary text-primary-foreground text-sm font-bold">
            H
          </div>
          <span className="text-base font-bold tracking-tight">Hono</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const href = `/${locale}${link.href}`;
            const isActive = pathname === href || (link.href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={link.href}
                href={href}
                className={cn(
                  "rounded-[0.375rem] px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isPortalLoggedIn ? (
            <Link href={`/${locale}/portal/dashboard`}>
              <Button variant="ghost" size="icon" className="hidden md:flex" title={portalCustomerName ?? t("my_space")}>
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href={`/${locale}/login`}>
              <Button variant="ghost" size="icon" className="hidden md:flex">
                <User className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Link href={`/${locale}/cart`}>
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-4 w-4" />
              {totalItems > 0 && (
                <Badge variant="default" className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {totalItems > 99 ? "99+" : totalItems}
                </Badge>
              )}
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="border-t md:hidden">
          <nav className="flex flex-col gap-2 p-4">
            {navLinks.map((link) => {
              const href = `/${locale}${link.href}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={link.href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            {isPortalLoggedIn ? (
              <Link href={`/${locale}/portal/dashboard`} onClick={() => setMobileOpen(false)}>
                <Button variant="default" className="w-full mt-2">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {t("my_space")}
                </Button>
              </Link>
            ) : (
              <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="w-full mt-2">
                  <User className="mr-2 h-4 w-4" />
                  {t("client_portal")}
                </Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
