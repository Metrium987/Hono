"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalVerifyPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    () => token ? "loading" : "error"
  );
  const [errorMsg, setErrorMsg] = useState(
    () => token ? "" : t("missing_token")
  );

  useEffect(() => {
    if (!token) return;

    async function verify() {
      try {
        const res = await fetch("/api/v1/portal/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json();
          setStatus("error");
          setErrorMsg(data.error ?? t("invalid_token"));
          return;
        }

        setStatus("success");
        // Redirect to dashboard after short delay
        setTimeout(() => router.push("./dashboard"), 1500);
      } catch {
        setStatus("error");
        setErrorMsg(t("connection_error"));
      }
    }

    verify();
  }, [token, router, t]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <h1 className="text-2xl font-bold tracking-tight mb-2">{t("verifying_title")}</h1>
          <p className="text-muted-foreground">{t("verifying_description")}</p>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
          <h1 className="text-2xl font-bold tracking-tight mb-2">{t("login_success")}</h1>
          <p className="text-muted-foreground">{t("login_success_description")}</p>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold tracking-tight mb-2">{t("login_failed")}</h1>
          <p className="text-muted-foreground mb-6">{errorMsg}</p>
          <Button onClick={() => router.push("./auth")}>
            {t("back_to_login")}
          </Button>
        </>
      )}
    </div>
  );
}
