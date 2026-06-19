import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, FileSignature, ClipboardList, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPortalSession } from "@/lib/portal/session";

export default async function PortalDashboardPage() {
  const session = await getPortalSession();
  if (!session) {
    redirect("./auth");
  }

  const pt = await getTranslations("portal");

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Fetch customer data
  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, email, phone, portal_enabled")
    .eq("id", session.customerId)
    .single();

  // Fetch counts
  const [{ count: quotesCount }, { count: invoicesCount }, { count: ordersCount }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", session.customerId),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", session.customerId),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", session.customerId),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {pt("hello", { name: customer?.contact_name ?? session.name ?? session.email })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {customer?.company_name ? `${customer.company_name} — ` : ""}
            {customer?.email}
          </p>
        </div>
        <form action="/api/v1/portal/logout" method="POST">
          <Button variant="outline" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            {pt("logout")}
          </Button>
        </form>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Link href="./quotes">
          <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">{pt("my_quotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{quotesCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="./invoices">
          <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">{pt("my_invoices")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{invoicesCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="./orders">
          <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">{pt("my_orders")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{ordersCount ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
