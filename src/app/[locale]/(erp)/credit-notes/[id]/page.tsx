import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

type CreditNoteItem = {
  id: string;
  description: string;
  quantity: string | number;
  unit_price_ht: string | number | null;
  line_total_ht: string | number | null;
  tax_rates: { rate: number } | Array<{ rate: number }> | null;
};

type CreditNote = {
  id: string;
  credit_note_number: string;
  status: string;
  issue_date: string;
  reason: string | null;
  total_ttc: number | string | null;
  customer: { company_name: string | null; contact_name: string; email: string | null; phone: string | null } | Array<{ company_name: string | null; contact_name: string; email: string | null; phone: string | null }> | null;
  currency: { symbol: string | null } | Array<{ symbol: string | null }> | null;
  items: CreditNoteItem[];
  invoice: { id: string; invoice_number: string } | Array<{ id: string; invoice_number: string }> | null;
};

function formatCurrency(amount: number | string | null, symbol?: string) {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount ?? 0));
  const formatted = n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? `${formatted} ${symbol}` : `${formatted} F`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function unwrap<T>(value: T | Array<T> | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapItems(items: CreditNoteItem[] | null | undefined): CreditNoteItem[] {
  return Array.isArray(items) ? items : [];
}

function getTaxRate(item: CreditNoteItem): number | null {
  const tr = item.tax_rates;
  if (Array.isArray(tr)) return tr[0]?.rate ?? null;
  return tr?.rate ?? null;
}

export default async function CreditNoteDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const perm = await checkPagePermission("credit_notes", "read");
  if (!perm.allowed) return <ForbiddenPage module="credit_notes" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const t = await getTranslations("credit_note_detail");
  const st = await getTranslations("credit_note_status");
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  const { data: cn } = await supabase
    .from("credit_notes")
    .select("*, customer:customer_id(*), currency:currency_id(code, symbol, symbol_position), items:credit_note_items(*, tax_rates:tax_rate_id(name, rate)), invoice:invoice_id(id, invoice_number)")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (!cn) return <div className="text-center py-12 text-muted-foreground">{common("not_found")}</div>;

  const note = cn as CreditNote;
  const customer = unwrap(note.customer);
  const currency = unwrap(note.currency);
  const invoiceLink = unwrap(note.invoice);
  const items = unwrapItems(note.items);

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
            <h1 className="text-2xl font-bold tracking-tight">{note.credit_note_number}</h1>
            <p className="text-sm text-muted-foreground">{t("issued_on", { date: formatDate(note.issue_date) })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[note.status as keyof typeof statusVariant] ?? "secondary"}>
            {st(note.status as keyof typeof st)}
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
            <p className="text-sm">{note.reason ?? "-"}</p>
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
                {items.map((item) => {
                  const taxRate = getTaxRate(item);
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">{item.description}</td>
                      <td className="text-right py-2">{typeof item.quantity === "number" ? item.quantity.toLocaleString("fr-FR") : item.quantity}</td>
                      <td className="text-right py-2">{formatCurrency(item.unit_price_ht as number | string | null)}</td>
                      <td className="text-right py-2">{taxRate !== null ? `${taxRate}%` : "-"}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(item.line_total_ht)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="border-t mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total TTC</span>
              <span className="font-bold text-lg">{formatCurrency(note.total_ttc, currency?.symbol ?? undefined)}</span>
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
