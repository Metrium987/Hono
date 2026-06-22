"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Plus, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type PaymentMethod = { id: string; name: string; display_name: string | null };
type Currency = { id: string; code: string; symbol: string };

type RecordPaymentFormProps = {
  invoiceId: string;
  teamId: string;
  remaining: number;
  currencySymbol: string;
  invoiceTotal: number;
  paidAmount: number;
  paymentMethods: PaymentMethod[];
  currencies: Currency[];
};

export function RecordPaymentForm({
  invoiceId, teamId, remaining, currencySymbol, invoiceTotal, paidAmount,
  paymentMethods, currencies,
}: RecordPaymentFormProps) {
  const t = useTranslations("payment_form");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [amount, setAmount] = useState(remaining.toString());
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [currencyId, setCurrencyId] = useState(currencies[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens — use onOpenChange instead of effect
  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (newOpen) {
      setAmount(remaining.toString());
      setPaymentMethodId(paymentMethods[0]?.id ?? "");
      setCurrencyId(currencies[0]?.id ?? "");
      setReference("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setError("");
      setSuccess(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !paymentMethodId || !currencyId) {
      setError(t("validation_error"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/payments?team_id=${teamId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payment_method_id: paymentMethodId,
          currency_id: currencyId,
          reference: reference || undefined,
          payment_date: paymentDate,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? t("save_error"));
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        window.location.reload();
      }, 1500);
    } catch {
      setError(common("connection_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> {t("title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Check className="h-12 w-12 text-green-600 mb-4" />
            <p className="font-medium">{t("success_message")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{common("total_ttc")}</span><span>{invoiceTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currencySymbol}</span></div>
              {paidAmount > 0 && <div className="flex justify-between text-green-600"><span>{t("already_paid")}</span><span>-{paidAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currencySymbol}</span></div>}
              <div className="flex justify-between font-medium"><span>{t("remaining_to_pay")}</span><span>{remaining.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currencySymbol}</span></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount_label")}</Label>
              <Input id="amount" type="number" step="0.01" min="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm">{t("method_label")}</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger><SelectValue placeholder={common("select_placeholder")} /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.display_name ?? pm.name}</SelectItem>
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

            <div className="space-y-2">
              <Label htmlFor="reference">{t("reference_label")}</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("reference_placeholder")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">{t("date_label")}</Label>
              <Input id="date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
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
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("saving")}</> : t("submit_button")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
