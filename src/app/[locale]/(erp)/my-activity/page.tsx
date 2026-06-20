import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, FileText } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-muted text-muted-foreground border",
};
const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", sent: "Envoyée", paid: "Payée", overdue: "En retard", cancelled: "Annulée" };

export default async function MyActivityPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const [{ data: invoices }, { data: customers }, { data: commissions }] = await Promise.all([
    supabase.from("invoices")
      .select("id, number, status, total_ttc, issue_date, customer:customer_id(contact_name)")
      .eq("assigned_to", user.id)
      .order("issue_date", { ascending: false })
      .limit(50),
    supabase.from("customers")
      .select("id, contact_name, company_name, customer_type")
      .eq("assigned_to", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("invoice_commissions")
      .select(`*, invoice:invoice_id(number, total_ttc, customer:customer_id(contact_name))`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const invList = invoices ?? [];
  const custList = customers ?? [];
  const commList = commissions ?? [];

  const caTtc = invList.filter((i) => i.status === "paid").reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
  const pendingComm = commList.filter((c) => c.status === "pending").reduce((s, c) => s + parseFloat(String(c.amount)), 0);
  const paidComm = commList.filter((c) => c.status === "paid").reduce((s, c) => s + parseFloat(String(c.amount)), 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon activité</h1>
        <p className="text-sm text-muted-foreground">Vos factures, clients et commissions</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Factures assignées", value: invList.length, color: "" },
          { label: "CA encaissé", value: `${Math.round(caTtc).toLocaleString("fr-FR")} F`, color: "" },
          { label: "Commission due", value: `${Math.round(pendingComm).toLocaleString("fr-FR")} F`, color: "text-amber-600" },
          { label: "Commission payée", value: `${Math.round(paidComm).toLocaleString("fr-FR")} F`, color: "text-green-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Invoices */}
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Mes factures</h2>
          {invList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture attribuée</p>
          ) : invList.slice(0, 10).map((inv) => {
            const custName = Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name?: string } | null)?.contact_name ?? "—";
            return (
              <Link key={inv.id} href={`../invoices/${inv.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{inv.number} · {custName}</p>
                  <p className="text-xs text-muted-foreground">{new Date(inv.issue_date).toLocaleDateString("fr-FR")} · {Math.round(parseFloat(String(inv.total_ttc || 0))).toLocaleString("fr-FR")} F TTC</p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${STATUS_STYLES[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
              </Link>
            );
          })}
        </div>

        {/* Commissions */}
        <div className="space-y-3">
          <h2 className="font-semibold">Mes commissions</h2>
          {commList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune commission calculée</p>
          ) : commList.slice(0, 10).map((c) => {
            const inv = c.invoice as { number?: string; total_ttc?: number; customer?: { contact_name?: string }[] | { contact_name?: string } | null } | null;
            const custName = inv?.customer ? (Array.isArray(inv.customer) ? inv.customer[0]?.contact_name : (inv.customer as { contact_name?: string }).contact_name) : "—";
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Facture {inv?.number} · {custName}</p>
                  <p className="text-xs text-muted-foreground">Taux {c.rate}% · <strong>{Math.round(parseFloat(String(c.amount))).toLocaleString("fr-FR")} F</strong></p>
                </div>
                {c.status === "paid" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customers */}
      {custList.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Mes clients</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {custList.map((c) => (
              <Link key={c.id} href={`../customers/${c.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors text-sm">
                <span>{c.contact_name}{c.company_name ? ` · ${c.company_name}` : ""}</span>
                <Badge variant="outline" className="text-[10px]">
                  {c.customer_type === "vip" ? "VIP" : c.customer_type === "prospect" ? "Prospect" : "Client"}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
