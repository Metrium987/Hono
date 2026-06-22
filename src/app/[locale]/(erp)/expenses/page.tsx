import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type ExpenseCurrency = { symbol?: string | null } | null;

type ExpenseRow = {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  vendor_name: string;
  currency: ExpenseCurrency;
  category: { name: string } | null;
};

export default async function ExpensesPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const categoryId = typeof sp.category_id === "string" ? sp.category_id : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  // Vérification des permissions
  const perm = await checkPagePermission("expenses", "read");
  if (!perm.allowed) return <ForbiddenPage module="expenses" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("expenses_page");
  const common = await getTranslations("common");

  const teamId = perm.teamId;
  if (!teamId) return <div>{common("no_team")}</div>;

  // Fetch categories for filter
  const { data: categories } = await supabase
    .from("expense_categories")
    .select("id, name")
    .eq("team_id", teamId)
    .order("name");

  // Build query
  let query = supabase
    .from("expenses")
    .select(`
      id, description, amount, expense_date, vendor_name,
      currency:currency_id(symbol),
      category:category_id(name)
    `, { count: "exact" })
    .eq("team_id", teamId);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data: rawExpenses, count } = await query
    .order("expense_date", { ascending: false })
    .range(offset, offset + limit - 1);

  const expenses: ExpenseRow[] = (rawExpenses ?? []).map((exp) => ({
    id: exp.id,
    description: exp.description,
    amount: exp.amount,
    expense_date: exp.expense_date,
    vendor_name: exp.vendor_name ?? "",
    currency: Array.isArray(exp.currency) ? (exp.currency[0] ?? null) : exp.currency ?? null,
    category: Array.isArray(exp.category) ? (exp.category[0] ?? null) : exp.category ?? null,
  }));

  const totalPages = Math.ceil((count ?? 0) / limit);

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatCurrency(amount: number, symbol: string) {
    return `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${symbol}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle", { count: count ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="./expenses/new">
            <Plus className="mr-2 h-4 w-4" /> {t("new_expense")}
          </Link>
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Link href=".">
          <Button variant={!categoryId ? "default" : "outline"} size="sm">{t("filter_all")}</Button>
        </Link>
        {(categories ?? []).map((cat) => (
          <Link key={cat.id} href={`?category_id=${cat.id}`}>
            <Button variant={categoryId === cat.id ? "default" : "outline"} size="sm">{cat.name}</Button>
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{t("th_date")}</th>
                <th className="text-left p-3 font-medium">{t("th_description")}</th>
                <th className="text-left p-3 font-medium">{t("th_vendor")}</th>
                <th className="text-left p-3 font-medium">{t("th_category")}</th>
                <th className="text-right p-3 font-medium">{t("th_amount")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">
                    {t("no_expenses")}
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-3">{formatDate(exp.expense_date)}</td>
                    <td className="p-3 font-medium">{exp.description}</td>
                    <td className="p-3 text-muted-foreground">{exp.vendor_name || "—"}</td>
                    <td className="p-3">
                      {exp.category ? <Badge variant="secondary">{exp.category.name}</Badge> : "—"}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(exp.amount, exp.currency?.symbol ?? "F")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`?page=${p}${categoryId ? `&category_id=${categoryId}` : ""}`}>
              <Button variant={page === p ? "default" : "outline"} size="sm">{p}</Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
