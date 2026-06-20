"use client";

import { useState, useEffect, FormEvent, use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type Category = { id: string; name: string };
type Currency = { id: string; code: string; symbol: string };
type Customer = { id: string; company_name: string | null; contact_name: string };

export default function EditIncomePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const t = useTranslations("income_form");
  const common = useTranslations("common");

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [teamId, setTeamId] = useState("");

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
          const [incRes, catRes, curRes, cusRes] = await Promise.all([
            fetch(`/api/v1/income/${id}?team_id=${tid}`),
            fetch(`/api/v1/income-categories?team_id=${tid}`),
            fetch(`/api/v1/currencies?team_id=${tid}`),
            fetch(`/api/v1/customers?limit=200&team_id=${tid}`),
          ]);

          const incData = await incRes.json();
          const inc = incData.data;
          if (inc) {
            setDescription(inc.description ?? "");
            setAmount(String(inc.amount ?? ""));
            setIncomeDate(inc.income_date?.split("T")[0] ?? new Date().toISOString().split("T")[0]);
            setCategoryId(inc.category_id ?? "");
            setCurrencyId(inc.currency_id ?? "");
            setCustomerId(inc.customer_id ?? "");
            setNotes(inc.notes ?? "");
          }

          const [catData, curData, cusData] = await Promise.all([
            catRes.json(), curRes.json(), cusRes.json(),
          ]);
          setCategories(catData.data ?? []);
          setCurrencies(curData.data ?? []);
          setCustomers(cusData.data ?? []);
          if (!inc?.currency_id && curData.data?.[0]) setCurrencyId(curData.data[0].id);
        }
      } catch { /* ignore */ }
      setInitialLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!description || !amount) { setError(t("validation_error")); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/income/${id}?team_id=${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount),
          income_date: incomeDate,
          category_id: categoryId || null,
          currency_id: currencyId || null,
          customer_id: customerId || null,
          notes: notes.trim() || null,
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
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">{t("description_label")}</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} required />
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
