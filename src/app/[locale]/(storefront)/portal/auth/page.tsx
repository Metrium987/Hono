"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PortalAuthPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("error_occurred"));
        return;
      }

      setSent(true);
    } catch {
      setError(t("connection_error_retry"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <h1 className="text-2xl font-bold tracking-tight mb-2">{t("email_sent_title")}</h1>
        <p className="text-muted-foreground">
          {t("email_sent_description")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("portal_title")}</CardTitle>
          <CardDescription>
            {t("portal_subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email_label")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("email_placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  {t("portal_submit")}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
