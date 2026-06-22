"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format-currency";

type Customer = { id: string; company_name: string | null; contact_name: string; email: string | null };
type Currency = { id: string; code: string; symbol: string; symbol_position: string; is_default: boolean };
type TaxRate = { id: string; name: string; rate: number; is_active: boolean };

const quoteItemSchema = z.object({
  description: z.string().min(1, "La description est requise"),
  quantity: z.coerce.number().positive("Doit être > 0").default(1),
  unit_price_ht: z.coerce.number().nonnegative().default(0),
  tax_rate_id: z.string().optional().default(""),
});

const quoteFormSchema = z.object({
  customer_id: z.string().min(1, "Veuillez sélectionner un client"),
  issue_date: z.string().min(1, "Date requise"),
  validity_date: z.string().optional().default(""),
  currency_id: z.string().min(1, "Devise requise"),
  notes: z.string().optional().default(""),
  items: z.array(quoteItemSchema).min(1, "Ajoutez au moins une ligne de devis"),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

type QuoteFormProps = {
  customers: Customer[];
  currencies: Currency[];
  taxRates: TaxRate[];
  teamId: string;
  editId?: string;
  initialData?: Partial<QuoteFormValues> & { items?: { key?: string; description: string; quantity: string | number; unit_price_ht: string | number; tax_rate_id: string }[] };
};

export function QuoteForm({ customers, currencies, taxRates, teamId, editId, initialData }: QuoteFormProps) {
  const router = useRouter();
  const common = useTranslations("common");
  const t = useTranslations("quote_form");
  const errT = useTranslations("errors");

  const defaultCurrency = currencies.find((c) => c.is_default) ?? currencies[0];

  const { control, register, watch, setError, setValue, formState, handleSubmit } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      customer_id: initialData?.customer_id ?? "",
      issue_date: initialData?.issue_date ?? new Date().toISOString().split("T")[0],
      validity_date: initialData?.validity_date ?? new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      currency_id: initialData?.currency_id ?? defaultCurrency?.id ?? "",
      notes: initialData?.notes ?? "",
      items: initialData?.items?.map((i) => ({
        description: i.description,
        quantity: typeof i.quantity === "string" ? parseFloat(i.quantity) || 1 : i.quantity,
        unit_price_ht: typeof i.unit_price_ht === "string" ? parseFloat(i.unit_price_ht) || 0 : i.unit_price_ht,
        tax_rate_id: i.tax_rate_id ?? "",
      })) ?? [{ description: "", quantity: 1, unit_price_ht: 0, tax_rate_id: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const currencyId = watch("currency_id");
  const activeCurrency = currencies.find((c) => c.id === currencyId);

  const { subtotal, taxTotal, total } = useMemo(() => {
    const items = watchedItems ?? [];
    const sub = items.reduce((sum, item) => {
      const qty = item.quantity || 0;
      const price = item.unit_price_ht || 0;
      return sum + qty * price;
    }, 0);
    const tax = items.reduce((sum, item) => {
      const qty = item.quantity || 0;
      const price = item.unit_price_ht || 0;
      const lineTotal = qty * price;
      if (item.tax_rate_id) {
        const rate = taxRates.find((r) => r.id === item.tax_rate_id);
        if (rate) return sum + lineTotal * (rate.rate / 100);
      }
      return sum;
    }, 0);
    return { subtotal: sub, taxTotal: tax, total: sub + tax };
  }, [watchedItems, taxRates]);

  const onSubmit = useCallback(async (data: QuoteFormValues) => {
    const payload = {
      customer_id: data.customer_id,
      issue_date: data.issue_date,
      validity_date: data.validity_date || null,
      currency_id: data.currency_id,
      notes: data.notes || null,
      items: data.items.filter((i) => i.description.trim()).map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price_ht: i.unit_price_ht,
        tax_rate_id: i.tax_rate_id || null,
      })),
    };

    try {
      const url = editId
        ? `/api/v1/quotes/${editId}?team_id=${teamId}`
        : `/api/v1/quotes?team_id=${teamId}`;
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? errT("validation_error"));
      router.push(editId ? `../${json.data.id}` : `./${json.data.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur";
      setError("root", { message });
    }
  }, [editId, teamId, router, errT, setError]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {formState.errors.root && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {formState.errors.root.message}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{t("section_customer_dates")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer">{t("customer_label")}</Label>
            <Select value={watch("customer_id")} onValueChange={(v) => setValue("customer_id", v, { shouldValidate: true })}>
              <SelectTrigger id="customer" className={formState.errors.customer_id ? "border-destructive" : ""}>
                <SelectValue placeholder={t("select_customer_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_name || c.contact_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.customer_id && <p className="text-xs text-destructive">{formState.errors.customer_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">{t("currency_label")}</Label>
            <Select value={watch("currency_id")} onValueChange={(v) => setValue("currency_id", v, { shouldValidate: true })}>
              <SelectTrigger id="currency" className={formState.errors.currency_id ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} ({c.symbol})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.currency_id && <p className="text-xs text-destructive">{formState.errors.currency_id.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue_date">{t("issue_date_label")}</Label>
            <Input id="issue_date" type="date" {...register("issue_date")} className={formState.errors.issue_date ? "border-destructive" : ""} />
            {formState.errors.issue_date && <p className="text-xs text-destructive">{formState.errors.issue_date.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="validity_date">{t("validity_date_label")}</Label>
            <Input id="validity_date" type="date" {...register("validity_date")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("section_items")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unit_price_ht: 0, tax_rate_id: "" })}>
            <Plus className="mr-2 h-4 w-4" /> {t("add_line")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 mb-2 px-1 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">{t("th_description")}</div>
            <div className="col-span-2 text-right">{t("th_quantity")}</div>
            <div className="col-span-2 text-right">{t("th_unit_price")}</div>
            <div className="col-span-2">{t("th_tax")}</div>
            <div className="col-span-1" />
          </div>

          {fields.map((field, idx) => {
            const itemErrors = formState.errors.items?.[idx];
            return (
              <div key={field.id} className="grid grid-cols-12 gap-2 mb-2 items-start">
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    placeholder={t("description_placeholder")}
                    {...register(`items.${idx}.description`)}
                    className={itemErrors?.description ? "border-destructive" : ""}
                  />
                  {itemErrors?.description && typeof itemErrors.description === 'object' && 'message' in itemErrors.description && (
                    <p className="text-xs text-destructive mt-0.5">{itemErrors.description.message as string}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number" step="any" min="0"
                    placeholder={t("qty_placeholder")}
                    {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                    className={`text-right ${itemErrors?.quantity ? "border-destructive" : ""}`}
                  />
                  {itemErrors?.quantity && typeof itemErrors.quantity === 'object' && 'message' in itemErrors.quantity && (
                    <p className="text-xs text-destructive mt-0.5">{itemErrors.quantity.message as string}</p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number" step="0.01" min="0"
                    placeholder={t("price_placeholder")}
                    {...register(`items.${idx}.unit_price_ht`, { valueAsNumber: true })}
                    className={`text-right ${itemErrors?.unit_price_ht ? "border-destructive" : ""}`}
                  />
                  {itemErrors?.unit_price_ht && typeof itemErrors.unit_price_ht === 'object' && 'message' in itemErrors.unit_price_ht && (
                    <p className="text-xs text-destructive mt-0.5">{itemErrors.unit_price_ht.message as string}</p>
                  )}
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <Select
                    value={watch(`items.${idx}.tax_rate_id`)}
                    onValueChange={(v) => setValue(`items.${idx}.tax_rate_id`, v, { shouldValidate: true })}
                  >
                    <SelectTrigger className={itemErrors?.tax_rate_id ? "border-destructive" : ""}>
                      <SelectValue placeholder={t("th_tax")} />
                    </SelectTrigger>
                    <SelectContent>
                      {taxRates.filter((r) => r.is_active).map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.rate}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}

          {formState.errors.items && !Array.isArray(formState.errors.items) && (
            <p className="text-xs text-destructive mt-2">{formState.errors.items.message}</p>
          )}

          <Separator className="my-4" />

          <div className="ml-auto space-y-1 sm:w-64">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{common("total_ht")}</span>
              <span>{formatCurrency(subtotal, activeCurrency?.code ?? "XPF")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{common("tax")}</span>
              <span>{formatCurrency(taxTotal, activeCurrency?.code ?? "XPF")}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>{common("total_ttc")}</span>
              <span className="text-primary">{formatCurrency(total, activeCurrency?.code ?? "XPF")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("section_notes")}</CardTitle></CardHeader>
        <CardContent>            <Textarea {...register("notes")} placeholder={t("notes_placeholder")} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>{t("cancel_button")}</Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editId ? t("save_button") : t("submit_button")}
        </Button>
      </div>
    </form>
  );
}
