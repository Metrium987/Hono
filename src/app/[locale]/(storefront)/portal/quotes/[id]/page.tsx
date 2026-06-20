import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPortalSession } from "@/lib/portal/session";

type QuoteItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  tax_rate: { rate: number } | Array<{ rate: number }> | null;
};

type QuoteCurrency = { symbol?: string | null; code?: string | null } | Array<{ symbol?: string | null; code?: string | null }> | null;

type PortalQuote = {
  id: string;
  quote_number: string;
  status: string;
  issue_date: string;
  validity_date: string | null;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  notes: string | null;
  currency: QuoteCurrency;
  items: QuoteItem[];
};

function unwrapCurrency(value: QuoteCurrency): { symbol?: string | null; code?: string | null } | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapRate(item: QuoteItem["tax_rate"]): number | null {
  if (Array.isArray(item)) return item[0]?.rate ?? null;
  return item?.rate ?? null;
}

function getStatusBadge(s: string, qt: (key: string) => string) {
  const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
    draft: "secondary",
    sent: "default",
    viewed: "default",
    accepted: "success",
    rejected: "destructive",
    expired: "secondary",
    converted: "default",
  };
  return <Badge variant={variants[s] ?? "default"}>{qt(s)}</Badge>;
}

export default async function PortalQuoteDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const { id } = await props.params;

  const [qt, pt] = await Promise.all([
    getTranslations("quote_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: quote } = await supabase
    .from("quotes")
    .select(`
      id, quote_number, status, issue_date, validity_date,
      subtotal_ht, tax_amount, total_ttc, notes,
      currency:currency_id(symbol, code),
      items:quote_items(*, tax_rate:tax_rate_id(name, rate))
    `)
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .single<PortalQuote>();

  if (!quote) notFound();

  const currency = unwrapCurrency(quote.currency);
  const items: QuoteItem[] = Array.isArray(quote.items) ? quote.items : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="./.."
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux devis
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{quote.quote_number}</h1>
            {getStatusBadge(quote.status, qt)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Émis le {new Date(quote.issue_date).toLocaleDateString("fr-FR")}
            {quote.validity_date && ` — Valable jusqu'au ${new Date(quote.validity_date).toLocaleDateString("fr-FR")}`}
          </p>
        </div>
      </div>

      {/* Items table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Détails du devis</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left pb-3 font-medium">Description</th>
                <th className="text-right pb-3 font-medium">Qté</th>
                <th className="text-right pb-3 font-medium">Prix unitaire HT</th>
                <th className="text-right pb-3 font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-3">
                    <p>{item.description}</p>
                    {item.tax_rate ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        TVA {unwrapRate(item.tax_rate)}%
                      </p>
                    ) : null}
                  </td>
                  <td className="text-right py-3">{typeof item.quantity === "number" ? item.quantity.toLocaleString("fr-FR") : item.quantity}</td>
                  <td className="text-right py-3">
                    {typeof item.unit_price_ht === "number" ? item.unit_price_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className="text-right py-3 font-medium">
                    {typeof item.line_total_ht === "number" ? item.line_total_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-6">
        <CardContent className="p-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total HT</span>
            <span>{quote.subtotal_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TVA</span>
            <span>+ {quote.tax_amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total TTC</span>
            <span className="text-primary">{quote.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
