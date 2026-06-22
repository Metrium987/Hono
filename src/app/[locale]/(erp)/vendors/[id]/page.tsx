import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, name, contact_name, email, phone, address, n_tahiti, notes, created_at")
    .eq("id", id)
    .eq("team_id", teamId)
    .single();

  if (error || !vendor) notFound();

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
    </div>
  );
}
