import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

export default async function ExpenseDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const perm = await checkPagePermission("expenses", "read");
  if (!perm.allowed) return <ForbiddenPage module="expenses" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  const { data: expense, error } = await supabase
    .from("expenses")
    .select(`
      id, description, amount, expense_date, notes, receipt_url,
      category:category_id(id, name),
      vendor:vendor_id(id, name),
      vendor_name,
      currency:currency_id(code, symbol)
    `)
    .eq("id", id)
    .eq("team_id", teamId)
    .is("deleted_at", null)
    .single();

  if (error || !expense) notFound();

  const category = Array.isArray(expense.category) ? expense.category[0] : expense.category;
  const vendor = Array.isArray(expense.vendor) ? expense.vendor[0] : expense.vendor;
  const currency = Array.isArray(expense.currency) ? expense.currency[0] : expense.currency;
  const sym = (currency as { symbol?: string | null } | null)?.symbol ?? "F";

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  }

  function fmt(amount: number) {
    return `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${sym}`;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../expenses"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{expense.description}</h1>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`${id}/edit`}><Pencil className="mr-2 h-4 w-4" />{common("edit")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Montant :</span>
            <p className="font-semibold text-lg">{fmt(expense.amount)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Date :</span>
            <p className="font-medium">{formatDate(expense.expense_date)}</p>
          </div>
          {category && (
            <div>
              <span className="text-muted-foreground">Catégorie :</span>
              <p className="font-medium">{(category as { name: string }).name}</p>
            </div>
          )}
          {(vendor || expense.vendor_name) && (
            <div>
              <span className="text-muted-foreground">Fournisseur :</span>
              {vendor ? (
                <Link href={`../vendors/${(vendor as { id: string }).id}`} className="font-medium text-primary hover:underline">
                  {(vendor as { name: string }).name}
                </Link>
              ) : (
                <p className="font-medium">{expense.vendor_name}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {expense.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">{common("notes")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{expense.notes}</p>
          </CardContent>
        </Card>
      )}

      {expense.receipt_url && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Justificatif</p>
            <Button variant="outline" asChild>
              <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                Voir le justificatif
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
