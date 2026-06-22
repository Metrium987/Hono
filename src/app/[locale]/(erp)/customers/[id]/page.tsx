import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Pencil, MessageSquare, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { DeleteRequestButton } from "@/components/erp/delete-request-button";

type Params = Promise<{ id: string }>;

export default async function CustomerDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const t = await getTranslations("customer_detail");
  const common = await getTranslations("common");
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>{common("no_team")}</div>;

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*, portal_users(*)")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !customer) notFound();

  const { data: team } = await supabase.from("teams").select("is_educational_mode").eq("id", teamId).single();
  const isEducational = team?.is_educational_mode ?? false;

  const [invoicesRes, quotesRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date, total_ttc, status, paid_amount, currency:currency_id(symbol)")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(10),
    supabase
      .from("quotes")
      .select("id, quote_number, issue_date, total_ttc, status")
      .eq("customer_id", id)
      .order("issue_date", { ascending: false })
      .limit(10),
  ]);

  const invoices = invoicesRes.data ?? [];
  const quotes = quotesRes.data ?? [];

  function fmt(amount: number, symbol = "F") {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${symbol}`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../customers"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{customer.company_name || customer.contact_name}</h1>
            {customer.portal_enabled ? (
              <Badge variant="success">Portail</Badge>
            ) : (
              <Badge variant="secondary">Portail désactivé</Badge>
            )}
          </div>
          {customer.company_name && customer.contact_name && (
            <p className="text-sm text-muted-foreground">{customer.contact_name}</p>
          )}
        </div>
        <Button variant="outline" asChild>
          <Link href={`../../calendar?customer_id=${id}`}><CalendarPlus className="mr-2 h-4 w-4" />Planifier RDV</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${id}/crm`}><MessageSquare className="mr-2 h-4 w-4" />{t("crm_title")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`${id}/edit`}><Pencil className="mr-2 h-4 w-4" />{t("edit")}</Link>
        </Button>
        {isEducational && (
          <DeleteRequestButton teamId={teamId} tableName="customers" recordId={id} />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("contact")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {customer.contact_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("company")}</span>
                <span>{customer.company_name || "—"}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("email")}</span>
              <span>{customer.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("phone")}</span>
              <span>{customer.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("tahiti")}</span>
              <span>{customer.n_tahiti || "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Adresse</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            {customer.address_line1 && <p>{customer.address_line1}</p>}
            {customer.address_line2 && <p>{customer.address_line2}</p>}
            <p>
              {[customer.postal_code, customer.city, customer.island].filter(Boolean).join(" ")}
            </p>
            {!customer.address_line1 && !customer.address_line2 && (
              <p className="text-muted-foreground">Aucune adresse renseignée</p>
            )}
          </CardContent>
        </Card>

        {customer.portal_users && customer.portal_users.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{t("portal_enabled")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {(customer.portal_users as Array<{ email: string; last_login_at: string | null }>).map((pu) => (
                <div key={pu.email} className="flex justify-between">
                  <span>{pu.email}</span>
                  <span className="text-muted-foreground">
                    {pu.last_login_at ? `Dernière connexion : ${formatDate(pu.last_login_at)}` : "Jamais connecté"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">{t("invoices_title")}</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`../invoices/${inv.id}`}>
                <Card className="hover:shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <span className="font-medium">{inv.invoice_number}</span>
                      <span className="text-muted-foreground ml-2">{formatDate(inv.issue_date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{fmt(inv.total_ttc, inv.currency?.[0]?.symbol ?? "F")}</span>
                      <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "destructive" : "secondary"}>
                        {inv.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{t("quotes_title")}</h2>
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun devis</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q) => (
              <Link key={q.id} href={`../quotes/${q.id}`}>
                <Card className="hover:shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="flex items-center justify-between p-3 text-sm">
                    <div>
                      <span className="font-medium">{q.quote_number}</span>
                      <span className="text-muted-foreground ml-2">{formatDate(q.issue_date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{fmt(q.total_ttc)}</span>
                      <Badge variant={q.status === "accepted" ? "success" : q.status === "draft" ? "secondary" : "default"}>
                        {q.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
