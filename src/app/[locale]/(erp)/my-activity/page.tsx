import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Circle, FileText, Users, Plus,
  TrendingUp, Euro, Clock, Star,
} from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-muted text-muted-foreground border",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", paid: "Payée",
  overdue: "En retard", cancelled: "Annulée", partial: "Partielle",
};

const TYPE_STYLES: Record<string, string> = {
  vip: "bg-amber-100 text-amber-700 border-amber-200",
  prospect: "bg-blue-100 text-blue-700 border-blue-200",
  client: "bg-green-100 text-green-700 border-green-200",
};
const TYPE_LABELS: Record<string, string> = {
  vip: "VIP", prospect: "Prospect", client: "Client",
};

function fmt(n: number) {
  return Math.round(n).toLocaleString("fr-FR") + " F";
}

export default async function MyActivityPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: membership } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1).single();
  if (!membership) return <div>Aucune équipe associée à ce compte.</div>;

  const [invoicesRes, customersRes, commissionsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_ttc, issue_date, customer:customer_id(id, contact_name, company_name)")
      .eq("assigned_to", user.id)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(50),
    supabase
      .from("customers")
      .select("id, contact_name, company_name, customer_type, email, phone, created_at")
      .eq("assigned_to", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_commissions")
      .select("*, invoice:invoice_id(invoice_number, total_ttc, customer:customer_id(contact_name))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const invoices = invoicesRes.data ?? [];
  const customers = customersRes.data ?? [];
  const commissions = commissionsRes.data ?? [];

  // KPIs
  const caTtc = invoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
  const pipelineTtc = invoices
    .filter(i => ["sent", "partial", "overdue"].includes(i.status))
    .reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
  const pendingComm = commissions
    .filter(c => c.status === "pending")
    .reduce((s, c) => s + parseFloat(String(c.amount)), 0);
  const paidComm = commissions
    .filter(c => c.status === "paid")
    .reduce((s, c) => s + parseFloat(String(c.amount)), 0);

  // Per-customer stats from my invoices
  const invoicesByCustomer = new Map<string, { ca: number; count: number; lastDate: string; hasOverdue: boolean }>();
  for (const inv of invoices) {
    const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
    if (!cust?.id) continue;
    const existing = invoicesByCustomer.get(cust.id as string) ?? { ca: 0, count: 0, lastDate: "", hasOverdue: false };
    existing.count++;
    if (inv.status === "paid") existing.ca += parseFloat(String(inv.total_ttc || 0));
    if (!existing.lastDate || inv.issue_date > existing.lastDate) existing.lastDate = inv.issue_date;
    if (inv.status === "overdue") existing.hasOverdue = true;
    invoicesByCustomer.set(cust.id as string, existing);
  }

  const vipCustomers = customers.filter(c => c.customer_type === "vip");
  const otherCustomers = customers.filter(c => c.customer_type !== "vip");

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon activité</h1>
        <p className="text-sm text-muted-foreground">Vos clients, factures et commissions</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Clients assignés", value: customers.length, icon: Users, color: "" },
          { label: "CA encaissé", value: fmt(caTtc), icon: TrendingUp, color: "text-green-600" },
          { label: "Pipeline en cours", value: fmt(pipelineTtc), icon: Clock, color: "text-blue-600" },
          { label: "Commission due", value: fmt(pendingComm), icon: Euro, color: "text-amber-600" },
        ].map(k => (
          <div key={k.label} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" />
              <p className="text-xs">{k.label}</p>
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* My Clients */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Mes clients
            <Badge variant="secondary">{customers.length}</Badge>
          </h2>
          <Button size="sm" asChild>
            <Link href="../customers/new"><Plus className="h-3.5 w-3.5 mr-1" />Nouveau client</Link>
          </Button>
        </div>

        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucun client ne vous est assigné.</p>
        ) : (
          <>
            {vipCustomers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider flex items-center gap-1">
                  <Star className="h-3 w-3" /> VIP
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {vipCustomers.map(c => <CustomerCard key={c.id} c={c} stats={invoicesByCustomer.get(c.id)} />)}
                </div>
              </div>
            )}

            {otherCustomers.length > 0 && (
              <div className="space-y-2">
                {vipCustomers.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Autres</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {otherCustomers.map(c => <CustomerCard key={c.id} c={c} stats={invoicesByCustomer.get(c.id)} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Separator />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent invoices */}
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Mes factures récentes
            <Badge variant="secondary">{invoices.length}</Badge>
          </h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture attribuée</p>
          ) : invoices.slice(0, 10).map(inv => {
            const cust = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer;
            const custName = (cust as { contact_name?: string; company_name?: string } | null)?.company_name
              ?? (cust as { contact_name?: string } | null)?.contact_name ?? "—";
            return (
              <Link
                key={inv.id}
                href={`../invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.invoice_number} · {custName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.issue_date).toLocaleDateString("fr-FR")} · {fmt(parseFloat(String(inv.total_ttc || 0)))} TTC
                  </p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${STATUS_STYLES[inv.status] ?? ""}`}>
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </Badge>
              </Link>
            );
          })}
        </div>

        {/* Commissions */}
        <div className="space-y-3">
          <h2 className="font-semibold">
            Mes commissions
            {paidComm > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {fmt(paidComm)} payées
              </span>
            )}
          </h2>
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commission calculée</p>
          ) : commissions.slice(0, 10).map(c => {
            const inv = c.invoice as { invoice_number?: string; total_ttc?: number; customer?: { contact_name?: string }[] | { contact_name?: string } | null } | null;
            const custName = inv?.customer
              ? (Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name?: string }).contact_name)
              : "—";
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">Facture {inv?.invoice_number} · {custName}</p>
                  <p className="text-xs text-muted-foreground">
                    Taux {c.rate}% · <strong>{fmt(parseFloat(String(c.amount)))}</strong>
                  </p>
                </div>
                {c.status === "paid"
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type CustRow = {
  id: string;
  contact_name: string;
  company_name: string | null;
  customer_type: string;
  email: string | null;
  phone: string | null;
};

type CustStats = { ca: number; count: number; lastDate: string; hasOverdue: boolean } | undefined;

function CustomerCard({ c, stats }: { c: CustRow; stats: CustStats }) {
  const displayName = c.company_name ?? c.contact_name;

  return (
    <Card className={`hover:shadow-sm transition-all ${stats?.hasOverdue ? "border-red-200" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {c.company_name && (
              <p className="text-xs text-muted-foreground truncate">{c.contact_name}</p>
            )}
          </div>
          <Badge className={`text-[10px] shrink-0 ${TYPE_STYLES[c.customer_type] ?? ""}`}>
            {TYPE_LABELS[c.customer_type] ?? c.customer_type}
          </Badge>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div>
              <span className="text-muted-foreground">CA encaissé</span>
              <p className="font-semibold text-green-700">{fmt(stats.ca)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Factures</span>
              <p className="font-semibold">{stats.count}</p>
            </div>
          </div>
        )}

        {stats?.hasOverdue && (
          <p className="text-[10px] text-red-600 font-medium">⚠ Facture en retard</p>
        )}

        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 flex-1" asChild>
            <Link href={`../customers/${c.id}`}>Voir fiche</Link>
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 flex-1" asChild>
            <Link href={`../invoices/new?customer_id=${c.id}`}>+ Facture</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
