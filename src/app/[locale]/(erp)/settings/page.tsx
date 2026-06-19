import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CreditCard, Key, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  const t = await getTranslations("settings_page");
  const common = await getTranslations("common");

  if (!user) return <div>{common("not_connected")}</div>;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, is_owner")
    .eq("user_id", user.id)
    .limit(1);

  const teamId = memberships?.[0]?.team_id;
  const isOwner = memberships?.[0]?.is_owner ?? false;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">Gérez la configuration de votre entreprise</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="./settings/payment-methods">
          <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-medium">{t("payment_methods_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {t("payment_methods_desc")}
              </p>
            </CardContent>
          </Card>
        </Link>

        {isOwner && (
          <Link href="./settings/api-keys">
            <Card className="hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-medium">{t("api_keys_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("api_keys_desc")}
                </p>
              </CardContent>
            </Card>
          </Link>
        )}

        <Card className="opacity-60 cursor-not-allowed">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{t("team_coming_soon")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("team_desc")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
