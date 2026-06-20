"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTeamId } from "@/hooks/use-team-id";

export default function NewCustomerPage() {
  const router = useRouter();
  const t = useTranslations("customer_form");
  const common = useTranslations("common");
  const teamId = useTeamId();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [contactName, setContactName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isB2b, setIsB2b] = useState(false);
  const [nTahiti, setNTahiti] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [island, setIsland] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("30");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contactName.trim()) {
      setError(t("error_required"));
      return;
    }
    if (isB2b && !nTahiti.trim()) {
      setError(t("n_tahiti_required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (!teamId) return;
      const res = await fetch(`/api/v1/customers?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName.trim(),
          company_name: companyName.trim() || null,
          is_b2b: isB2b,
          n_tahiti: nTahiti.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          city: city.trim() || null,
          island: island.trim() || null,
          postal_code: postalCode.trim() || null,
          portal_enabled: portalEnabled,
          payment_terms: parseInt(paymentTerms) || 30,
          notes: notes.trim() || null,
          source: "erp",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? common("unknown_error"));
        return;
      }
      const data = await res.json();
      router.push(`../customers/${data.data.id}`);
      router.refresh();
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="../customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back_to_customers")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title_new")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_identity")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">{t("contact_name_label")} *</Label>
              <Input id="contact_name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jean Dupont" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">{t("company_name_label")}</Label>
              <Input id="company_name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="SARL Exemple" />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="is_b2b" checked={isB2b} onCheckedChange={setIsB2b} />
              <Label htmlFor="is_b2b">{t("is_b2b_label")}</Label>
            </div>

            {isB2b && (
              <div className="space-y-2">
                <Label htmlFor="n_tahiti">{t("n_tahiti_label")} *</Label>
                <Input id="n_tahiti" value={nTahiti} onChange={(e) => setNTahiti(e.target.value)} placeholder="123456A" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@exemple.pf" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone_label")}</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+689 87 00 00 00" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_address")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_line1">{t("address_line1_label")}</Label>
              <Input id="address_line1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 rue des Cocotiers" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">{t("address_line2_label")}</Label>
              <Input id="address_line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="BP 1234" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">{t("postal_code_label")}</Label>
                <Input id="postal_code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="98714" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("city_label")}</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Papeete" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="island">{t("island_label")}</Label>
                <Input id="island" value={island} onChange={(e) => setIsland(e.target.value)} placeholder="Tahiti" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_settings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="portal_enabled" checked={portalEnabled} onCheckedChange={setPortalEnabled} />
              <Label htmlFor="portal_enabled">{t("portal_enabled_label")}</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">{t("payment_terms_label")}</Label>
              <Input id="payment_terms" type="number" min="0" max="365" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-32" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes_label")}</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common("creating")}</> : t("submit_create")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="../customers">{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
