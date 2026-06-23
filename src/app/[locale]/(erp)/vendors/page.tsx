import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function VendorsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const page = Math.max(1, parseInt(typeof sp.page === "string" ? sp.page : "1"));
  const search = typeof sp.search === "string" ? sp.search.trim() : "";
  const limit = 20;
  const offset = (page - 1) * limit;

  const perm = await checkPagePermission("clients", "read");
  if (!perm.allowed) return <ForbiddenPage module="vendors" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const t = await getTranslations("vendors_page");
  const common = await getTranslations("common");

  const teamId = perm.teamId;

  let query = supabase.from("vendors").select("id, name, contact_name, email, phone, n_tahiti, notes, created_at", { count: "exact" }).eq("team_id", teamId);
  if (search) {
    query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const { data, count } = await query.order("name", { ascending: true }).range(offset, offset + limit - 1);

  const vendors = data ?? [];
  const totalPages = Math.ceil((count ?? 0) / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle", { count: count ?? 0 })}</p>
        </div>
        <Button asChild>
          <Link href="./vendors/new">
            <Plus className="mr-2 h-4 w-4" /> {t("new_vendor")}
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input name="search" defaultValue={search} placeholder="Rechercher un fournisseur..." className="pl-9" />
        </div>
        {search && (
          <Button variant="ghost" size="sm" asChild>
            <Link href=".">Effacer</Link>
          </Button>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left p-3 font-medium">{t("th_name")}</th>
                <th className="text-left p-3 font-medium">{t("th_contact")}</th>
                <th className="text-left p-3 font-medium">{t("th_email")}</th>
                <th className="text-left p-3 font-medium">{t("th_phone")}</th>
                <th className="text-right p-3 font-medium">{t("th_n_tahiti")}</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-muted-foreground">
                    {t("no_vendors")}
                  </td>
                </tr>
              ) : (
                vendors.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-3 font-medium">{v.name}</td>
                    <td className="p-3 text-muted-foreground">{v.contact_name || "—"}</td>
                    <td className="p-3 text-muted-foreground">{v.email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{v.phone || "—"}</td>
                    <td className="p-3 text-right text-muted-foreground">{v.n_tahiti || "—"}</td>
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
            <Link key={p} href={`?page=${p}`}>
              <Button variant={page === p ? "default" : "outline"} size="sm">{p}</Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
