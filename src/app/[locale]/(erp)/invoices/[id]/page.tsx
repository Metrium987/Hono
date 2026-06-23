import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Plus, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RecordPaymentForm } from "./record-payment-form";
import { PaymentsList } from "./payments-list";
import { PaymentEvidenceSection } from "./payment-evidence-section";
import { ClientPaymentProofs } from "./client-payment-proofs";
import { DeleteInvoiceDialog } from "./delete-invoice-dialog";
import { SendInvoiceButton } from "./send-invoice-button";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type InvoiceItem = {
  id: string;
  description: string;
  quantity: string;
  unit_price_ht: string | number | null;
  line_total_ht: string | number | null;
  tax_rates: Array<{ name: string; rate: number }> | null;
};

type InvoicePayment = {
  id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  payment_method: { id: string; name: string; display_name: string | null } | null;
};

type InvoiceEvent = {
  id: string;
  event_type: string;
  created_at: string;
};

type InvoiceWithRelations = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  service_date: string | null;
  due_date: string;
  total_ttc: number;
  subtotal_ht: number;
  tax_amount: number;
  paid_amount: number;
  legal_mentions: string | null;
  currency: { symbol?: string | null } | Array<{ symbol?: string | null }> | null;
  customer: { id: string; company_name: string | null; contact_name: string; email: string | null; phone: string | null } | Array<{ id: string; company_name: string | null; contact_name: string; email: string | null; phone: string | null }> | null;
  team: { name: string } | Array<{ name: string }> | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  events: InvoiceEvent[];
};

type Params = Promise<{ id: string }>;

export default async function InvoiceDetailPage(props: { params: Params }) {
  const { id } = await props.params;

  const det = await getTranslations("invoice_detail");
  const statusT = await getTranslations("invoice_status");
  const common = await getTranslations("common");

  const perm = await checkPagePermission("invoices", "read");
  if (!perm.allowed) return <ForbiddenPage module="invoices" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const { data: paymentMethodsData } = await supabase
    .from("payment_methods")
    .select("id, name, display_name")
    .eq("team_id", teamId)
    .eq("is_active", true);

  const { data: currenciesData } = await supabase
    .from("currencies")
    .select("id, code, symbol")
    .order("code");

  const paymentMethods: Array<{ id: string; name: string; display_name: string | null }> = paymentMethodsData ?? [];
  const currencies: Array<{ id: string; code: string; symbol: string }> = currenciesData ?? [];

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(`
      *,
      customer:customer_id(id, company_name, contact_name, email, phone, is_b2b, n_tahiti),
      team:team_id(name, n_tahiti, is_franchise_en_base, bank_name, bank_rib, bank_iban, bank_bic, late_fee_fixed, invoice_prefix),
      currency:currency_id(code, symbol, symbol_position),
      items:invoice_items(*, tax_rates:tax_rate_id(name, rate)),
      payments:invoice_payments(*, payment_method:payment_method_id(id, name, display_name)),
      events:invoice_events(*, created_by_user:created_by(id, full_name)),
      quote:quote_id(id, quote_number)
    `)
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !invoice) notFound();

  const currency = Array.isArray(invoice.currency) ? invoice.currency[0] : invoice.currency;
  const invoiceCustomer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const items: InvoiceItem[] = Array.isArray(invoice.items) ? invoice.items : [];
  const payments: InvoicePayment[] = Array.isArray(invoice.payments) ? invoice.payments : [];
  const totalTtc = parseFloat(invoice.total_ttc) || 0;
  const paidAmount = parseFloat(invoice.paid_amount) || 0;
  const remaining = Math.max(0, totalTtc - paidAmount);
  const canRecordPayment = !["cancelled", "refunded"].includes(invoice.status) && remaining > 0;

  function getStatusBadge(s: string) {
    const map: Record<string, { labelKey: string; variant: string }> = {
      draft: { labelKey: "draft", variant: "secondary" },
      sent: { labelKey: "sent", variant: "info" },
      viewed: { labelKey: "viewed", variant: "info" },
      partial: { labelKey: "partial", variant: "warning" },
      paid: { labelKey: "paid", variant: "success" },
      overdue: { labelKey: "overdue", variant: "destructive" },
      cancelled: { labelKey: "cancelled", variant: "secondary" },
      refunded: { labelKey: "refunded", variant: "secondary" },
    };
    const m = map[s] ?? { labelKey: s, variant: "default" };
    return <Badge variant={m.variant as never}>{statusT(m.labelKey)}</Badge>;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatCurrency(amount: number) {
    return `${Math.round(amount).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency?.symbol ?? "F"}`;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="./.." className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
            <ArrowLeft className="h-4 w-4" /> {det("back_to_invoices")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            {getStatusBadge(invoice.status)}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {det("issued_on", { date: formatDate(invoice.issue_date) })}
            {invoice.service_date && <> — {det("service_date", { date: formatDate(invoice.service_date) })}</>}
            <br />{det("due_date_label", { date: formatDate(invoice.due_date) })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/api/v1/invoices/${id}/pdf`} target="_blank">
              <Download className="mr-2 h-4 w-4" /> {common("pdf")}
            </Link>
          </Button>
          {!["draft", "cancelled"].includes(invoice.status) && (() => {
            const customerEmail = Array.isArray(invoice.customer) ? invoice.customer[0]?.email : invoice.customer?.email;
            return customerEmail ? (
              <SendInvoiceButton invoiceId={id} teamId={teamId} customerEmail={customerEmail} />
            ) : null;
          })()}
          {invoice.status === "draft" && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`./${id}/edit`}>{common("edit")}</Link>
            </Button>
          )}
          {["sent", "viewed", "partial", "paid", "overdue"].includes(invoice.status) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`../../credit-notes/new?invoice_id=${id}`}>
                <FileX className="mr-2 h-4 w-4" /> {det("generate_credit_note")}
              </Link>
            </Button>
          )}
          <DeleteInvoiceDialog
            invoiceId={id}
            invoiceNumber={invoice.invoice_number}
            teamId={teamId}
            status={invoice.status}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items table */}
          <Card>
            <CardHeader><CardTitle className="text-lg">{det("items_title")}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left pb-2 font-medium">{det("th_description")}</th>
                    <th className="text-right pb-2 font-medium">{det("th_qty")}</th>
                    <th className="text-right pb-2 font-medium">{det("th_price_ht")}</th>
                    <th className="text-right pb-2 font-medium">{det("th_total_ht")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id as string} className="border-b last:border-0">
                      <td className="py-2">{item.description as string}</td>
                      <td className="text-right py-2">{item.quantity as string}</td>
                      <td className="text-right py-2">{formatCurrency(parseFloat(item.unit_price_ht as string) || 0)}</td>
                      <td className="text-right py-2 font-medium">{formatCurrency(parseFloat(item.line_total_ht as string) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{det("payments_title")}</CardTitle>
              {canRecordPayment && (
                <RecordPaymentForm
                  invoiceId={id}
                  teamId={teamId}
                  remaining={remaining}
                  currencySymbol={currency?.symbol ?? "F"}
                  invoiceTotal={totalTtc}
                  paidAmount={paidAmount}
                  paymentMethods={paymentMethods}
                  currencies={currencies}
                />
              )}
            </CardHeader>
            <CardContent>
              <PaymentsList
                payments={payments}
                currencySymbol={currency?.symbol ?? "F"}
                invoiceId={id}
              />
            </CardContent>
          </Card>

          {/* Client-submitted payment declarations */}
          <ClientPaymentProofs invoiceId={id} teamId={teamId} />

          {/* Payment evidence (staff-uploaded files) */}
          <PaymentEvidenceSection invoiceId={id} teamId={teamId} payments={payments} />

          {/* Events */}
          {Array.isArray(invoice.events) && invoice.events.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg">{det("history_title")}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(invoice.events ?? []).map((evt: InvoiceEvent) => (
                    <div key={evt.id as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {evt.event_type === "created" ? det("event_created")
                          : evt.event_type === "sent" ? det("event_sent")
                          : evt.event_type === "payment_recorded" ? det("event_payment_recorded")
                          : evt.event_type === "email_sent" ? det("event_email_sent")
                          : evt.event_type === "status_changed" ? det("event_status_changed")
                          : (evt.event_type as string)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(evt.created_at as string)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — summary & customer */}
        <div className="space-y-6">
          {/* Customer info */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">{det("client_title")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {invoiceCustomer && (
                <>
                  <Link
                    href={`../customers/${invoiceCustomer.id}`}
                    className="font-medium hover:text-primary hover:underline transition-colors"
                  >
                    {invoiceCustomer.company_name ?? invoiceCustomer.contact_name}
                  </Link>
                  {invoiceCustomer.email && <p className="text-muted-foreground">{invoiceCustomer.email}</p>}
                  {invoiceCustomer.phone && <p className="text-muted-foreground">{invoiceCustomer.phone}</p>}
                </>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">{det("totals_title")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{det("subtotal_ht")}</span><span>{(invoice.subtotal_ht as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{det("tax_amount")}</span><span>+ {(invoice.tax_amount as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currency?.symbol ?? "F"}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>{common("total_ttc")}</span><span className="text-primary">{formatCurrency(totalTtc)}</span></div>
              {paidAmount > 0 && (
                <div className="flex justify-between text-green-600"><span>{det("paid_label")}</span><span>-{formatCurrency(paidAmount)}</span></div>
              )}
              {remaining > 0 && paidAmount > 0 && (
                <div className="flex justify-between font-medium text-destructive"><span>{det("remaining_label")}</span><span>{formatCurrency(remaining)}</span></div>
              )}
            </CardContent>
          </Card>

          {/* Legal mentions */}
          {invoice.legal_mentions && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">{det("legal_mentions")}</CardTitle></CardHeader>
              <CardContent><p className="text-xs text-muted-foreground whitespace-pre-line">{invoice.legal_mentions as string}</p></CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
