import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type Params = Promise<{ id: string }>;

export default async function VendorDetailPage(props: { params: Params }) {
  const { id } = await props.params;
  const perm = await checkPagePermission("clients", "read");
  if (!perm.allowed) return <ForbiddenPage module="vendors" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("vendors_page");
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  const [{ data: vendor, error }, { data: expensesData }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, contact_name, email, phone, address, n_tahiti, notes, created_at")
      .eq("id", id)
      .eq("team_id", teamId)
      .single(),
    supabase
      .from("expenses")
      .select("id, description, amount, expense_date, category:category_id(name)")
      .eq("vendor_id", id)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .limit(10),
  ]);

  if (error || !vendor) notFound();

  const expenses = expensesData ?? [];

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function fmt(amount: number) {
    return `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F`;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../vendors"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{vendor.name}</h1>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`${id}/edit`}><Pencil className="mr-2 h-4 w-4" />{common("edit")}</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{common("contact")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{common("name")} :</span>
              <p className="font-medium">{vendor.contact_name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{common("email")} :</span>
              <p className="font-medium">{vendor.email || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{common("phone")} :</span>
              <p className="font-medium">{vendor.phone || "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{common("address")}</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{vendor.address || "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identifiants fiscaux</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">N° Tahiti :</span>
            <p className="font-medium">{vendor.n_tahiti || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {vendor.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">{common("notes")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{vendor.notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div>
        <h2 className="text-lg font-semibold mb-3">Dépenses</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune dépense enregistrée pour ce fournisseur</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => {
              const category = Array.isArray(e.category) ? e.category[0] : e.category;
              return (
                <Link key={e.id} href={`../expenses/${e.id}`}>
                  <Card className="hover:shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer">
                    <CardContent className="flex items-center justify-between p-3 text-sm">
                      <div>
                        <span className="font-medium">{e.description || "—"}</span>
                        <span className="text-muted-foreground ml-2">{formatDate(e.expense_date)}</span>
                        {category && (
                          <span className="text-xs text-muted-foreground ml-2">· {category.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{fmt(e.amount)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
