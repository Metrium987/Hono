import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function StorefrontFooter() {
  const t = await getTranslations("portal");
  const st = await getTranslations("storefront");

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold mb-3">Hono</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("app_description")}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("products")}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link href="/fr/products" className="hover:text-foreground transition-colors duration-150">{st("catalog")}</Link></li>
              <li><Link href="/fr/portal/auth" className="hover:text-foreground transition-colors duration-150">{st("client_portal")}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("legal")}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>{t("legal_mentions")}</li>
              <li><Link href="/fr/privacy" className="hover:text-foreground transition-colors duration-150">{t("privacy_policy")}</Link></li>
              <li>{t("terms")}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{st("contact")}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><a href="mailto:contact@hono.pf" className="hover:text-foreground transition-colors duration-150">{t("contact_email")}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Hono. {t("all_rights")}
        </div>
      </div>
    </footer>
  );
}
