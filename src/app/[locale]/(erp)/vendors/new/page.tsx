"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function NewVendorPage() {
  const router = useRouter();
  const t = useTranslations("vendor_form");
  const common = useTranslations("common");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nTahiti, setNTahiti] = useState("");
  const [notes, setNotes] = useState("");

  const perm = useClientPermission("clients", "write");
  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="vendors" action="write" />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      setError(t("validation_error"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact_name: contactName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          address: address || undefined,
          n_tahiti: nTahiti || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("create_error"));
        return;
      }

      router.push("../vendors");
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
        <Link href="../vendors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name_label")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("name_placeholder")} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">{t("contact_label")}</Label>
              <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t("contact_placeholder")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("email_placeholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone_label")}</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phone_placeholder")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">{t("address_label")}</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("address_placeholder")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ntahiti">{t("n_tahiti_label")}</Label>
              <Input id="ntahiti" value={nTahiti} onChange={(e) => setNTahiti(e.target.value)} placeholder={t("n_tahiti_placeholder")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes_label")}</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes_placeholder")} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {common("creating")}</> : t("submit_button")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
