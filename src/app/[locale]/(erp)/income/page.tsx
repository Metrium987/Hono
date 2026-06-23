import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

type IncomeRow = {
  id: string;
  description: string;
  amount: number;
  income_date: string;
  currency: { symbol?: string | null } | null;
  category: { name: string } | null;
  customer: { company_name?: string | null; contact_name: string } | null;
};

export default async function IncomePage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const categoryId = typeof sp.category_id === "string" ? sp.category_id : "";
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  // Vérification des permissions
  const perm = await checkPagePermission("income", "read");
  if (!perm.allowed) return <ForbiddenPage module="income" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("income_page");
  const common = await getTranslations("common");

  const teamId = perm.teamId;
  if (!teamId) return <div>{common("no_team")}</div>;

  const { data: categories } = await supabase
    .from("income_categories")
    .select("id, name")
    .eq("team_id", teamId)
    .order("name");

  let query = supabase
    .from("income")
    .select(`
      id, description, amount, income_date,
      currency:currency_id(symbol),
      category:category_id(name),
      customer:customer_id(company_name, contact_name)
    `, { count: "exact" })
    .eq("team_id", teamId);

  if (categoryId) query = query.eq("category_id", categoryId);

  const { data: rawIncome, count } = await query
    .order("income_date", { ascending: false })
    .range(offset, offset + limit - 1);

  const income: IncomeRow[] = (rawIncome ?? []).map((inc) => ({
    id: inc.id,
    description: inc.description,
    amount: inc.amount,
    income_date: inc.income_date,
    currency: Array.isArray(inc.currency) ? (inc.currency[0] ?? null) : inc.currency ?? null,
    category: Array.isArray(inc.category) ? (inc.category[0] ?? null) : inc.category ?? null,
    customer: Array.isArray(inc.customer) ? (inc.customer[0] ?? null) : inc.customer ?? null,
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
          <Link href="./income/new">
            <Plus className="mr-2 h-4 w-4" /> {t("new_income")}
          </Link>
        </Button>
      </div>

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

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{t("th_date")}</th>
                <th className="text-left p-3 font-medium">{t("th_description")}</th>
                <th className="text-left p-3 font-medium">{t("th_category")}</th>
                <th className="text-left p-3 font-medium">{t("th_client")}</th>
                <th className="text-right p-3 font-medium">{t("th_amount")}</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {income.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">
                    {t("no_income")}
                  </td>
                </tr>
              ) : (
                income.map((inc) => (
                  <tr key={inc.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors group">
                    <td className="p-3">{formatDate(inc.income_date)}</td>
                    <td className="p-3 font-medium">{inc.description}</td>
                    <td className="p-3">
                      {inc.category ? <Badge variant="secondary">{inc.category.name}</Badge> : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {inc.customer ? inc.customer.company_name ?? inc.customer.contact_name : "—"}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatCurrency(inc.amount, inc.currency?.symbol ?? "F")}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`./income/${inc.id}/edit`}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
