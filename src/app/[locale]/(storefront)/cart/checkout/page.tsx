"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Send, CheckCircle2, AlertCircle,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart/cart-context";

export default function CheckoutPage() {
  const t = useTranslations("storefront");
  const router = useRouter();
  const { items, subtotalTtc, clearCart } = useCart();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");

  if (items.length === 0 && !success) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground/50 mb-6" />
        <h1 className="text-2xl font-bold mb-3">{t("empty_cart_title")}</h1>
        <p className="text-muted-foreground mb-6">{t("empty_cart_hint")}</p>
        <Button asChild>
          <Link href="../../products">{t("see_catalog")}</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/portal/quote-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim() || undefined,
          company_name: company.trim() || undefined,
          notes: notes.trim() || undefined,
          items: items.map((i) => ({
            product_id: i.productId,
            description: i.name,
            quantity: i.quantity,
            unit_price_ht: i.priceHt,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t("checkout_error"));
        return;
      }

      setQuoteNumber(data.quote_number ?? "");
      setSuccess(true);
      clearCart();
    } catch {
      setError(t("connection_error_retry"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600 mb-6" />
        <h1 className="text-3xl font-bold tracking-tight mb-3">{t("quote_sent_title")}</h1>
        <p className="text-muted-foreground mb-2">
          {t("quote_sent_detail")}
        </p>
        {quoteNumber && (
          <p className="text-lg font-semibold text-primary mb-6">
            {t("quote_sent_message", { number: quoteNumber })}
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
          {t("quote_sent_description")}
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="../../products">{t("continue_shopping")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="../..">{t("back_home")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="../"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back_cart")}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-6">{t("checkout_title")}</h1>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Contact form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("your_details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("full_name_label")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.pf"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="87 70 00 00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Société</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Nom de votre société"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t("special_notes_label")}</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("contact_placeholder")}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("send_request")}
              </>
            )}
          </Button>
        </form>

        {/* Cart summary */}
        <div className="lg:col-span-2">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">{t("summary")} ({t("items_count", { count: items.length })})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => {
                const m = 1 + (item.taxRate ?? 0) / 100;
                return (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-muted-foreground truncate mr-2">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-medium shrink-0">
                    {(item.priceHt * m * item.quantity).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F TTC
                  </span>
                </div>
                );
              })}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>{t("total_ttc_estimated")}</span>
                <span className="text-primary">
                  {subtotalTtc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
