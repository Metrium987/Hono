import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SendQuoteButton } from "./send-quote-button";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

type QuoteItem = {
  id: string;
  description: string;
  quantity: number | string;
  unit_price_ht: number | string | null;
  line_total_ht: number | string | null;
  tax_rates: { name: string; rate: number } | Array<{ name: string; rate: number }> | null;
};

type QuoteWithRelations = {
  id: string;
  quote_number: string;
  status: string;
  issue_date: string;
  validity_date: string | null;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  notes: string | null;
  converted_to_invoice_id: string | null;
  customer: { company_name: string | null; contact_name: string; email: string | null } | Array<{ company_name: string | null; contact_name: string; email: string | null }> | null;
  currency: { symbol: string | null; code: string } | Array<{ symbol: string | null; code: string }> | null;
  items: QuoteItem[];
};

function unwrap<T>(v: T | Array<T> | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function fmt(n: number | string | null, sym = "F") {
  const val = typeof n === "number" ? n : parseFloat(String(n ?? 0));
  return `${Math.round(val).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${sym}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  sent: "default",
  viewed: "default",
  accepted: "success",
  rejected: "destructive",
  expired: "secondary",
  converted: "success",
};

export default async function QuoteDetailPage(props: { params: Params }) {
  const { id } = await props.params;

  const perm = await checkPagePermission("quotes", "read");
  if (!perm.allowed) return <ForbiddenPage module="quotes" />;

  const [statusT, common] = await Promise.all([
    getTranslations("quote_status"),
    getTranslations("common"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const [{ data: quote, error }, { data: pendingApproval }] = await Promise.all([
    supabase
      .from("quotes")
      .select(`
        id, quote_number, status, issue_date, validity_date,
        subtotal_ht, tax_amount, total_ttc, notes, converted_to_invoice_id,
        customer:customer_id(company_name, contact_name, email),
        currency:currency_id(code, symbol),
        items:quote_items(*, tax_rates:tax_rate_id(name, rate))
      `)
      .eq("id", id)
      .eq("team_id", teamId)
      .single<QuoteWithRelations>(),
    supabase
      .from("approvals")
      .select("id, status")
      .eq("team_id", teamId)
      .eq("entity_type", "quote")
      .eq("entity_id", id)
      .eq("status", "pending")
      .maybeSingle(),
  ]);

  if (error || !quote) notFound();

  const customer = unwrap(quote.customer);
  const currency = unwrap(quote.currency);
  const sym = currency?.symbol ?? "F";
  const items: QuoteItem[] = Array.isArray(quote.items) ? quote.items : [];

  const canEdit = quote.status === "draft";
  const canSend = !["accepted", "converted", "cancelled"].includes(quote.status) && !!customer?.email;
  const canConvert = ["sent", "viewed", "accepted"].includes(quote.status);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../quotes"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{quote.quote_number}</h1>
            <Badge variant={STATUS_VARIANT[quote.status] ?? "default"}>{statusT(quote.status)}</Badge>
            {pendingApproval && (
              <Badge variant="warning">Approbation en attente</Badge>
            )}
          </div>
          {customer && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {customer.company_name ?? customer.contact_name}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`./edit`}><Pencil className="mr-2 h-4 w-4" />Modifier</Link>
            </Button>
          )}
          {canSend && (
            <SendQuoteButton quoteId={id} teamId={teamId} customerEmail={customer!.email!} />
          )}
          {canConvert && (
            <Button asChild>
              <Link href={`./convert`}><FileText className="mr-2 h-4 w-4" />Convertir en facture</Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={`/api/v1/quotes/${id}/pdf?team_id=${teamId}`} target="_blank">
              <Download className="mr-2 h-4 w-4" />PDF
            </Link>
          </Button>
        </div>
      </div>

      {quote.converted_to_invoice_id && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Converti en facture —{" "}
          <Link href={`../invoices/${quote.converted_to_invoice_id}`} className="underline font-medium">
            voir la facture
          </Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Informations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date d&apos;émission</span>
              <span>{fmtDate(quote.issue_date)}</span>
            </div>
            {quote.validity_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Validité</span>
                <span>{fmtDate(quote.validity_date)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {customer && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Client</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{customer.company_name ?? customer.contact_name}</p>
              {customer.company_name && <p className="text-muted-foreground">{customer.contact_name}</p>}
              {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Articles</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground bg-muted/50">
                <th className="text-left px-6 py-3 font-medium">Description</th>
                <th className="text-right px-4 py-3 font-medium">Qté</th>
                <th className="text-right px-4 py-3 font-medium">Prix HT</th>
                <th className="text-right px-6 py-3 font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const tr = unwrap(item.tax_rates);
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-6 py-3">
                      <p>{item.description}</p>
                      {tr && <p className="text-xs text-muted-foreground mt-0.5">TVA {tr.rate}%</p>}
                    </td>
                    <td className="text-right px-4 py-3">{Number(item.quantity).toLocaleString("fr-FR")}</td>
                    <td className="text-right px-4 py-3">{fmt(item.unit_price_ht, "")}</td>
                    <td className="text-right px-6 py-3 font-medium">{fmt(item.line_total_ht, sym)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Aucun article</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Card className="w-full max-w-xs">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span>{fmt(quote.subtotal_ht, sym)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA</span>
              <span>+ {fmt(quote.tax_amount, sym)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total TTC</span>
              <span className="text-primary">{fmt(quote.total_ttc, sym)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {quote.notes && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
