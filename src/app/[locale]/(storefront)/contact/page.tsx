import { getTranslations } from "next-intl/server";
import { Mail, Phone, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function ContactPage() {
  const t = await getTranslations("contact_page");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight mb-4">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("subtitle")}</p>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <Mail className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm font-medium">{t("email_label")}</p>
            <p className="text-sm text-muted-foreground">{t("email_value")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <Phone className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm font-medium">{t("phone_label")}</p>
            <p className="text-sm text-muted-foreground">{t("phone_value")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <MapPin className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm font-medium">{t("address_label")}</p>
            <p className="text-sm text-muted-foreground">{t("address_value")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
