import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", partial: "Partiel", paid: "Payé", overdue: "En retard", cancelled: "Annulé",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
  pending: "secondary", partial: "warning", paid: "success", overdue: "destructive", cancelled: "secondary",
};

type Installment = {
  id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: string;
};

export default async function ReceivableDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const perm = await checkPagePermission("finance", "read");
  if (!perm.allowed) return <ForbiddenPage module="finance" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: ar, error } = await supabase
    .from("account_receivables")
    .select("*, customer:customer_id(id, name), invoice:invoice_id(id, number), installments:ar_installments(*)")
    .eq("id", id)
    .eq("team_id", perm.teamId)
    .single();

  if (error || !ar) notFound();

  const customer = Array.isArray(ar.customer) ? ar.customer[0] : ar.customer;
  const invoice = Array.isArray(ar.invoice) ? ar.invoice[0] : ar.invoice;
  const installments: Installment[] = Array.isArray(ar.installments) ? ar.installments : [];

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatCurrency(amount: number) {
    return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`;
  }

  const remaining = (ar.total_amount ?? 0) - (ar.paid_amount ?? 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../receivables"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Créance {ar.reference_number ?? ar.id.slice(0, 8)}</h1>
            <Badge variant={STATUS_VARIANTS[ar.status] ?? "secondary"}>
              {STATUS_LABELS[ar.status] ?? ar.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Créée le {formatDate(ar.created_at)} · Échéance le {formatDate(ar.due_date)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{customer?.name ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Facture associée</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">N° :</span> {invoice?.number ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Montant total</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(ar.total_amount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Payé</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(ar.paid_amount ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Restant</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(remaining)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Échéances</CardTitle></CardHeader>
        <CardContent className="p-0">
          {installments.length === 0 ? (
            <p className="text-center p-6 text-muted-foreground text-sm">Aucune échéance</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left p-3 font-medium">Date d&apos;échéance</th>
                  <th className="text-right p-3 font-medium">Montant</th>
                  <th className="text-right p-3 font-medium">Payé</th>
                  <th className="text-center p-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst) => (
                  <tr key={inst.id} className="border-b last:border-0">
                    <td className="p-3">{formatDate(inst.due_date)}</td>
                    <td className="p-3 text-right">{formatCurrency(inst.amount)}</td>
                    <td className="p-3 text-right">{formatCurrency(inst.paid_amount)}</td>
                    <td className="p-3 text-center">
                      <Badge variant={STATUS_VARIANTS[inst.status] ?? "secondary"}>
                        {STATUS_LABELS[inst.status] ?? inst.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
