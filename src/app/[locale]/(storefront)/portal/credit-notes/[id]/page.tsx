import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getPortalSession } from "@/lib/portal/session";

type CreditNoteItem = {
  id: string;
  description: string;
  quantity: number | string;
  unit_price_ht: number | string | null;
  line_total_ht: number | string | null;
  tax_rates: { rate: number } | Array<{ rate: number }> | null;
};

type PortalCreditNote = {
  id: string;
  credit_note_number: string;
  status: string;
  issue_date: string;
  reason: string | null;
  subtotal_ht: number | string;
  tax_amount: number | string;
  total_ttc: number | string;
  currency: { symbol: string | null } | Array<{ symbol: string | null }> | null;
  items: CreditNoteItem[];
  invoice: { id: string; invoice_number: string } | Array<{ id: string; invoice_number: string }> | null;
};

function unwrap<T>(v: T | Array<T> | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function toNum(v: number | string | null): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? 0));
}

function fmt(v: number | string | null, sym = "F") {
  return `${toNum(v).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${sym}`;
}

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  draft: "secondary",
  issued: "default",
  applied: "success",
  cancelled: "destructive",
};

export default async function PortalCreditNoteDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("../../portal/auth");

  const { id } = await props.params;

  const [pt, st] = await Promise.all([
    getTranslations("portal"),
    getTranslations("credit_note_status"),
  ]);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data } = await supabase
    .from("credit_notes")
    .select(`
      id, credit_note_number, status, issue_date, reason,
      subtotal_ht, tax_amount, total_ttc,
      currency:currency_id(symbol),
      items:credit_note_items(*, tax_rates:tax_rate_id(rate)),
      invoice:invoice_id(id, invoice_number)
    `)
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .single<PortalCreditNote>();

  if (!data) notFound();

  const currency = unwrap(data.currency);
  const sym = currency?.symbol ?? "F";
  const invoiceLink = unwrap(data.invoice);
  const items: CreditNoteItem[] = Array.isArray(data.items) ? data.items : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../credit-notes"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{data.credit_note_number}</h1>
            <Badge variant={STATUS_VARIANT[data.status] ?? "default"}>{st(data.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pt("issue_date")} : {new Date(data.issue_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {invoiceLink && (
        <div className="rounded-md border px-4 py-2 text-sm text-muted-foreground">
          {pt("credit_note_linked_invoice")} :{" "}
          <Link href={`../invoices/${invoiceLink.id}`} className="font-medium text-foreground underline">
            {invoiceLink.invoice_number}
          </Link>
        </div>
      )}

      {data.reason && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">{pt("credit_note_reason")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.reason}</p>
          </CardContent>
        </Card>
      )}

      <Card>
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
                    <td className="text-right px-4 py-3">{toNum(item.quantity).toLocaleString("fr-FR")}</td>
                    <td className="text-right px-4 py-3">{fmt(item.unit_price_ht, "")}</td>
                    <td className="text-right px-6 py-3 font-medium">{fmt(item.line_total_ht, sym)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Card className="w-full max-w-xs">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{pt("subtotal_ht")}</span>
              <span>{fmt(data.subtotal_ht, sym)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{pt("tax_amount")}</span>
              <span>+ {fmt(data.tax_amount, sym)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>{pt("total_ttc")}</span>
              <span className="text-primary">{fmt(data.total_ttc, sym)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
