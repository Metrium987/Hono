"use client";

import { useState, useEffect, FormEvent } from "react";
import { Loader2, Check, AlertCircle, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type CompanyData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  island: string | null;
  postal_code: string | null;
  country: string | null;
  n_tahiti: string | null;
  dicp_id: string | null;
  rcs_number: string | null;
  tax_id: string | null;
  is_franchise_en_base: boolean;
  bank_name: string | null;
  bank_rib: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  default_currency_id: string | null;
  website: string | null;
  logo_url: string | null;
  late_fee_fixed: number | null;
  timezone: string | null;
  is_educational_mode: boolean;
};

type ApiResponse = { data: CompanyData };

export default function CompanyPage() {
  const t = useTranslations("company_page");
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { createClient } = await import("@/utils/supabase/client");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .limit(1);
        const tid = memberships?.[0]?.team_id ?? "";
        setTeamId(tid);

        if (tid) {
          const res = await fetch(`/api/v1/settings/company?team_id=${tid}`);
          if (res.ok) {
            const body: ApiResponse = await res.json();
            setData(body.data);
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, []);

  function update(field: keyof CompanyData, value: unknown) {
    if (!data) return;
    setData({ ...data, [field]: value });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/v1/settings/company?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erreur");
        return;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erreur de connexion");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!data) {
    return <div className="py-12 text-center text-muted-foreground">{t("load_error")}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../settings"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_identity")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={data.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={data.email ?? ""} onChange={(e) => update("email", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" value={data.phone ?? ""} onChange={(e) => update("phone", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n_tahiti">{t("tahiti")}</Label>
              <Input id="n_tahiti" value={data.n_tahiti ?? ""} onChange={(e) => update("n_tahiti", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dicp_id">{t("dicp")}</Label>
              <Input id="dicp_id" value={data.dicp_id ?? ""} onChange={(e) => update("dicp_id", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rcs">{t("rcs")}</Label>
              <Input id="rcs" value={data.rcs_number ?? ""} onChange={(e) => update("rcs_number", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">{t("website")}</Label>
              <Input id="website" value={data.website ?? ""} onChange={(e) => update("website", e.target.value || null)} />
            </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="franchise"
                  checked={data.is_franchise_en_base}
                  onChange={(e) => update("is_franchise_en_base", e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="franchise">{t("franchise")}</Label>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="educational_mode"
                  checked={data.is_educational_mode}
                  onChange={(e) => update("is_educational_mode", e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="educational_mode">{t("educational_mode")}</Label>
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_address")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address_line1">{t("address_line1")}</Label>
              <Input id="address_line1" value={data.address_line1 ?? ""} onChange={(e) => update("address_line1", e.target.value || null)} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="address_line2">{t("address_line2")}</Label>
              <Input id="address_line2" value={data.address_line2 ?? ""} onChange={(e) => update("address_line2", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t("city")}</Label>
              <Input id="city" value={data.city ?? ""} onChange={(e) => update("city", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="island">{t("island")}</Label>
              <Input id="island" value={data.island ?? ""} onChange={(e) => update("island", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">{t("postal_code")}</Label>
              <Input id="postal_code" value={data.postal_code ?? ""} onChange={(e) => update("postal_code", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("country")}</Label>
              <Input id="country" value={data.country ?? ""} onChange={(e) => update("country", e.target.value || null)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_bank")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">{t("bank_name")}</Label>
              <Input id="bank_name" value={data.bank_name ?? ""} onChange={(e) => update("bank_name", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_rib">{t("bank_rib")}</Label>
              <Input id="bank_rib" value={data.bank_rib ?? ""} onChange={(e) => update("bank_rib", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_iban">{t("bank_iban")}</Label>
              <Input id="bank_iban" value={data.bank_iban ?? ""} onChange={(e) => update("bank_iban", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_bic">{t("bank_bic")}</Label>
              <Input id="bank_bic" value={data.bank_bic ?? ""} onChange={(e) => update("bank_bic", e.target.value || null)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_billing")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_prefix">{t("invoice_prefix")}</Label>
              <Input id="invoice_prefix" value={data.invoice_prefix ?? ""} onChange={(e) => update("invoice_prefix", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote_prefix">{t("quote_prefix")}</Label>
              <Input id="quote_prefix" value={data.quote_prefix ?? ""} onChange={(e) => update("quote_prefix", e.target.value || null)} />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("saving")}</> : t("save_button")}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> {t("saved")}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
