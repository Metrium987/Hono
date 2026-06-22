"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useClientPermission } from "@/hooks/use-client-permission";
import { ClientForbiddenPage } from "@/components/erp/client-forbidden";

type Category = { id: string; name: string };
type Vendor = { id: string; name: string };
type Currency = { id: string; code: string; symbol: string };

export default function NewExpensePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("expense_form");
  const common = useTranslations("common");

  const perm = useClientPermission("expenses", "write");
  if (!perm.allowed && !perm.loading) {
    return <ClientForbiddenPage module="expenses" action="write" />;
  }

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  useEffect(() => {
    async function load() {
      const [catRes, venRes, curRes] = await Promise.all([
        fetch("/api/v1/expense-categories"),
        fetch("/api/v1/vendors?limit=200"),
        fetch("/api/v1/currencies"),
      ]);
      const catData = await catRes.json();
      const venData = await venRes.json();
      const curData = await curRes.json();
      setCategories(catData.data ?? []);
      setVendors(venData.data ?? []);
      setCurrencies(curData.data ?? []);
      if (curData.data?.[0]) setCurrencyId(curData.data[0].id);
    }
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description || !amount || !expenseDate) {
      setError(t("validation_error"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amount: parseFloat(amount),
          expense_date: expenseDate,
          category_id: categoryId || undefined,
          vendor_id: vendorId || undefined,
          vendor_name: vendorName || undefined,
          currency_id: currencyId || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("create_error"));
        return;
      }

      router.push("../expenses");
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
        <Link href="../expenses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">{t("description_label")}</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("description_placeholder")} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">{t("amount_label")}</Label>
                <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">{t("date_label")}</Label>
                <Input id="date" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t("category_label")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t("currency_label")}</Label>
                <Select value={currencyId} onValueChange={setCurrencyId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">{t("vendor_label")}</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorName">{t("vendor_name_label")}</Label>
                <Input id="vendorName" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={t("vendor_name_placeholder")} />
              </div>
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
