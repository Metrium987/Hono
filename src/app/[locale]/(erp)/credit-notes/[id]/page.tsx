import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Params = Promise<{ id: string }>;

function formatCurrency(amount: number, symbol?: string) {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : `${formatted} F`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function CreditNoteDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("credit_note_detail");
  const st = await getTranslations("credit_note_status");
  const common = await getTranslations("common");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const { data: cn } = await supabase
    .from("credit_notes")
    .select("*, customer:customer_id(*), currency:currency_id(code, symbol, symbol_position), items:credit_note_items(*, tax_rates:tax_rate_id(name, rate)), invoice:invoice_id(id, invoice_number)")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!cn) return <div className="text-center py-12 text-muted-foreground">{common("not_found")}</div>;

  const customerArr = Array.isArray(cn.customer) ? cn.customer : [cn.customer];
  const customer = customerArr[0] ?? null;
  const currency = Array.isArray(cn.currency) ? cn.currency[0] : cn.currency;
  const invoiceLink = Array.isArray(cn.invoice) ? cn.invoice[0] : cn.invoice;
  const items = (cn as unknown as { items: Array<Record<string, unknown>> }).items ?? [];

  const statusVariant: Record<string, "secondary" | "success" | "destructive" | "default"> = {
    draft: "secondary",
    issued: "default",
    applied: "success",
    cancelled: "destructive",
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href=".."><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{cn.credit_note_number}</h1>
            <p className="text-sm text-muted-foreground">{t("issued_on", { date: formatDate(cn.issue_date) })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[cn.status as keyof typeof statusVariant] ?? "secondary"}>
            {st(cn.status as keyof typeof st)}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/v1/credit-notes/${id}/pdf`} target="_blank">
              <Download className="h-4 w-4 mr-1" /> PDF
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Client</CardTitle></CardHeader>
          <CardContent>
            {customer ? (
              <div className="text-sm space-y-1">
                <p className="font-medium">{customer.company_name ?? customer.contact_name}</p>
                {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
                {customer.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">-</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t("reason")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">{cn.reason ?? "-"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">{t("items_title")}</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{common("no_results")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Description</th>
                  <th className="text-right pb-2 font-medium">{common("quantity")}</th>
                  <th className="text-right pb-2 font-medium">{common("unit_price")}</th>
                  <th className="text-right pb-2 font-medium">TVA</th>
                  <th className="text-right pb-2 font-medium">{common("total_ht")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: Record<string, unknown>) => {
                  const taxRates = Array.isArray(item.tax_rates) ? item.tax_rates[0] as Record<string, unknown> : null;
                  return (
                    <tr key={item.id as string} className="border-b last:border-0">
                      <td className="py-2">{item.description as string}</td>
                      <td className="text-right py-2">{item.quantity as string}</td>
                      <td className="text-right py-2">{formatCurrency(parseFloat(String(item.unit_price_ht ?? "0")))}</td>
                      <td className="text-right py-2">{taxRates ? `${taxRates.rate}%` : "-"}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(parseFloat(String(item.line_total_ht ?? "0")))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="border-t mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total TTC</span>
              <span className="font-bold text-lg">{formatCurrency(parseFloat(String(cn.total_ttc ?? "0")), currency?.symbol)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoiceLink && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{t("invoice_linked")}</CardTitle></CardHeader>
          <CardContent>
            <Link href={`../invoices/${invoiceLink.id}`} className="text-sm text-primary hover:underline">
              {invoiceLink.invoice_number}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
