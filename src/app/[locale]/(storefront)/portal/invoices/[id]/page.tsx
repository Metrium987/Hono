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

export default async function PortalInvoiceDetailPage(
  props: { params: Promise<{ id: string }> }
) {
  const session = await getPortalSession();
  if (!session) redirect("./auth");

  const { id } = await props.params;

  const [it, pt] = await Promise.all([
    getTranslations("invoice_status"),
    getTranslations("portal"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *, 
      currency:currency_id(symbol, code),
      items:invoice_items(*, tax_rate:tax_rate_id(name, rate))
    `)
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .single();

  if (!invoice) notFound();

  const currency = Array.isArray(invoice.currency) ? invoice.currency[0] : invoice.currency;
  const items: Array<Record<string, unknown>> = Array.isArray(invoice.items) ? invoice.items : [];
  const paidAmount = parseFloat(invoice.paid_amount) || 0;
  const totalTtc = parseFloat(invoice.total_ttc) || 0;
  const remaining = totalTtc - paidAmount;

  function getStatusBadge(s: string) {
    const variants: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "info"> = {
      draft: "secondary",
      sent: "info",
      viewed: "info",
      partial: "warning",
      paid: "success",
      overdue: "destructive",
      cancelled: "secondary",
      refunded: "secondary",
    };
    return <Badge variant={variants[s] ?? "default"}>{it(s)}</Badge>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="./.."
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux factures
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            {getStatusBadge(invoice.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Émise le {new Date(invoice.issue_date).toLocaleDateString("fr-FR")}
            {invoice.service_date && ` — Service le ${new Date(invoice.service_date).toLocaleDateString("fr-FR")}`}
            <br />
            Échéance : {new Date(invoice.due_date).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/api/v1/invoices/${id}/pdf`} target="_blank">
            <Download className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Link>
        </Button>
      </div>

      {/* Items table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Détails de la facture</CardTitle>
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
                <tr key={item.id as string} className="border-b last:border-0">
                  <td className="py-3">
                    <p>{item.description as string}</p>
                    {item.tax_rate ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        TVA {((Array.isArray(item.tax_rate) ? item.tax_rate[0] : item.tax_rate) as Record<string, unknown>)?.rate as number ?? 0}%
                      </p>
                    ) : null}
                  </td>
                  <td className="text-right py-3">{item.quantity as string}</td>
                  <td className="text-right py-3">
                    {(item.unit_price_ht as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right py-3 font-medium">
                    {(item.line_total_ht as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
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
            <span>{(invoice.subtotal_ht as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TVA</span>
            <span>+ {(invoice.tax_amount as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total TTC</span>
            <span className="text-primary">{totalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
          </div>
          {paidAmount > 0 && (
            <>
              <div className="flex justify-between text-sm text-green-600">
                <span>Déjà payé</span>
                <span>- {paidAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-sm font-medium text-destructive">
                  <span>Reste à payer</span>
                  <span>{remaining.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes as string}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
