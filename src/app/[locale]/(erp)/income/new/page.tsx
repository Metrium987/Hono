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

type Category = { id: string; name: string };
type Currency = { id: string; code: string; symbol: string };
type Customer = { id: string; company_name: string | null; contact_name: string };

export default function NewIncomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("income_form");
  const common = useTranslations("common");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function load() {
      const [catRes, curRes, custRes] = await Promise.all([
        fetch("/api/v1/income-categories"),
        fetch("/api/v1/currencies"),
        fetch("/api/v1/customers?limit=200"),
      ]);
      const catData = await catRes.json();
      const curData = await curRes.json();
      const custData = await custRes.json();
      setCategories(catData.data ?? []);
      setCurrencies(curData.data ?? []);
      setCustomers(custData.data ?? []);
      if (curData.data?.[0]) setCurrencyId(curData.data[0].id);
    }
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description || !amount || !incomeDate) {
      setError(t("validation_error"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amount: parseFloat(amount),
          income_date: incomeDate,
          category_id: categoryId || undefined,
          currency_id: currencyId || undefined,
          customer_id: customerId || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("create_error"));
        return;
      }

      router.push("../income");
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
        <Link href="../income" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
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
                <Input id="date" type="date" value={incomeDate} onChange={(e) => setIncomeDate(e.target.value)} required />
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

            <div className="space-y-2">
              <Label htmlFor="customer">{t("client_label")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name ?? c.contact_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
