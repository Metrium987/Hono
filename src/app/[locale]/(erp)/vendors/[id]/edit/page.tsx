"use client";

import { useState, useEffect, FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

export default function EditVendorPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const t = useTranslations("vendor_form");
  const common = useTranslations("common");

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [nTahiti, setNTahiti] = useState("");
  const [notes, setNotes] = useState("");

  const perm = useClientPermission("clients", "write");

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
          const res = await fetch(`/api/v1/vendors/${id}?team_id=${tid}`);
          if (res.ok) {
            const { data } = await res.json();
            setName(data.name ?? "");
            setContactName(data.contact_name ?? "");
            setEmail(data.email ?? "");
            setPhone(data.phone ?? "");
            setAddress(data.address ?? "");
            setNTahiti(data.n_tahiti ?? "");
            setNotes(data.notes ?? "");
          }
        }
      } catch { /* ignore */ }
      setInitialLoading(false);
    }
    load();
  }, [id]);

  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="vendors" action="write" />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) { setError(t("validation_error")); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/vendors/${id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          contact_name: contactName || null,
          email: email || null,
          phone: phone || null,
          address: address || null,
          n_tahiti: nTahiti || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? common("unknown_error"));
        return;
      }
      router.push(`../${id}`);
      router.refresh();
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`../${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le fournisseur</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name_label")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">{t("contact_label")}</Label>
              <Input id="contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone_label")}</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("address_label")}</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ntahiti">{t("n_tahiti_label")}</Label>
              <Input id="ntahiti" value={nTahiti} onChange={(e) => setNTahiti(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes_label")}</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common("save")}</> : common("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
