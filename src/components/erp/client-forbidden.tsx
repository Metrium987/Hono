"use client";

import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ClientForbiddenProps = {
  module: string;
  action?: "read" | "write";
};

export function ClientForbiddenPage({ module, action = "read" }: ClientForbiddenProps) {
  const t = useTranslations("forbidden_page");

  const moduleKey = `module_${module}`;
  const moduleLabel = t.has(moduleKey) ? t(moduleKey) : t("module_fallback", { module });
  const actionLabel = t(`action_${action}`);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription className="text-base">
            {t("description", { action: actionLabel, module: moduleLabel })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("contact_owner")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
