import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, FileSignature, ClipboardList, LogOut, ReceiptText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortalSession } from "@/lib/portal/session";

export default async function PortalDashboardPage() {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const pt = await getTranslations("portal");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, email, phone, portal_enabled")
    .eq("id", session.customerId)
    .single();

  const [
    { count: quotesCount },
    { count: invoicesCount },
    { count: ordersCount },
    { count: creditNotesCount },
  ] = await Promise.all([
    supabase.from("quotes").select("*", { count: "exact", head: true }).eq("customer_id", session.customerId),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("customer_id", session.customerId),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("customer_id", session.customerId),
    supabase.from("credit_notes").select("*", { count: "exact", head: true }).eq("customer_id", session.customerId),
  ]);

  const navItems = [
    { href: "./quotes",       icon: FileSignature, label: pt("my_quotes"),       count: quotesCount ?? 0 },
    { href: "./invoices",     icon: FileText,      label: pt("my_invoices"),      count: invoicesCount ?? 0 },
    { href: "./orders",       icon: ClipboardList, label: pt("my_orders"),        count: ordersCount ?? 0 },
    { href: "./credit-notes", icon: ReceiptText,   label: pt("my_credit_notes"),  count: creditNotesCount ?? 0 },
  ] as const;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
      {/* Profile header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-wrap-balance">
            {pt("hello", { name: customer?.contact_name ?? session.name ?? session.email })}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {customer?.company_name ? `${customer.company_name} · ` : ""}
            {customer?.email}
          </p>
        </div>
        <form action="/api/v1/portal/logout" method="POST">
          <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground gap-2">
            <LogOut className="h-4 w-4" />
            {pt("logout")}
          </Button>
        </form>
      </div>

      {/* Document navigation — iOS grouped list */}
      <div className="rounded-xl border divide-y bg-card overflow-hidden">
        {navItems.map(({ href, icon: Icon, label, count }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-[15px] font-medium">{label}</span>
            <span className="text-[13px] font-semibold tabular-nums text-muted-foreground mr-1">
              {count}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
