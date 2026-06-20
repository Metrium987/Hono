"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z
  .object({
    contact_name: z.string().min(1, "Champ obligatoire"),
    company_name: z.string().optional(),
    is_b2b: z.boolean(),
    n_tahiti: z.string().optional(),
    email: z.union([z.string().email("Email invalide"), z.literal("")]).optional(),
    phone: z.string().optional(),
    address_line1: z.string().optional(),
    address_line2: z.string().optional(),
    city: z.string().optional(),
    island: z.string().optional(),
    postal_code: z.string().optional(),
    portal_enabled: z.boolean(),
    payment_terms: z.number().int().min(0).max(365),
    notes: z.string().optional(),
  })
  .refine((d) => !d.is_b2b || (d.n_tahiti?.trim().length ?? 0) > 0, {
    message: "Le N° Tahiti est obligatoire pour un client B2B",
    path: ["n_tahiti"],
  });

type FormValues = z.infer<typeof schema>;

export type CustomerFormProps = {
  teamId: string;
  customerId?: string;
  initialData?: Partial<FormValues>;
  backHref: string;
};

export function CustomerForm({ teamId, customerId, initialData, backHref }: CustomerFormProps) {
  const router = useRouter();
  const t = useTranslations("customer_form");
  const common = useTranslations("common");

  const isEdit = !!customerId;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contact_name: "",
      company_name: "",
      is_b2b: false,
      n_tahiti: "",
      email: "",
      phone: "",
      address_line1: "",
      address_line2: "",
      city: "",
      island: "",
      postal_code: "",
      portal_enabled: false,
      payment_terms: 30,
      notes: "",
      ...initialData,
    },
  });

  const isB2b = watch("is_b2b");

  async function onSubmit(values: FormValues) {
    const url = isEdit
      ? `/api/v1/customers/${customerId}?team_id=${teamId}`
      : `/api/v1/customers?team_id=${teamId}`;
    const method = isEdit ? "PATCH" : "POST";

    const body = {
      contact_name: values.contact_name.trim(),
      company_name: values.company_name?.trim() || null,
      is_b2b: values.is_b2b,
      n_tahiti: values.n_tahiti?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address_line1: values.address_line1?.trim() || null,
      address_line2: values.address_line2?.trim() || null,
      city: values.city?.trim() || null,
      island: values.island?.trim() || null,
      postal_code: values.postal_code?.trim() || null,
      portal_enabled: values.portal_enabled,
      payment_terms: values.payment_terms,
      notes: values.notes?.trim() || null,
      ...(isEdit ? {} : { source: "erp" }),
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError("root", { message: data.error ?? common("unknown_error") });
      return;
    }

    const data = await res.json();
    const id = isEdit ? customerId : data.data?.id;
    router.push(`../customers/${id}`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
          <ArrowLeft className="h-4 w-4" /> {t("back_to_customers")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{isEdit ? t("title_edit") : t("title_new")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_identity")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">{t("contact_name_label")} *</Label>
              <Input id="contact_name" {...register("contact_name")} placeholder="Jean Dupont" />
              {errors.contact_name && <p className="text-xs text-destructive">{errors.contact_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_name">{t("company_name_label")}</Label>
              <Input id="company_name" {...register("company_name")} placeholder="SARL Exemple" />
            </div>

            <div className="flex items-center gap-3">
              <Controller
                name="is_b2b"
                control={control}
                render={({ field }) => (
                  <Switch id="is_b2b" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="is_b2b">{t("is_b2b_label")}</Label>
            </div>

            {isB2b && (
              <div className="space-y-2">
                <Label htmlFor="n_tahiti">{t("n_tahiti_label")} *</Label>
                <Input id="n_tahiti" {...register("n_tahiti")} placeholder="123456A" />
                {errors.n_tahiti && <p className="text-xs text-destructive">{errors.n_tahiti.message}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email_label")}</Label>
                <Input id="email" type="email" {...register("email")} placeholder="contact@exemple.pf" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone_label")}</Label>
                <Input id="phone" type="tel" {...register("phone")} placeholder="+689 87 00 00 00" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_address")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address_line1">{t("address_line1_label")}</Label>
              <Input id="address_line1" {...register("address_line1")} placeholder="123 rue des Cocotiers" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_line2">{t("address_line2_label")}</Label>
              <Input id="address_line2" {...register("address_line2")} placeholder="BP 1234" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">{t("postal_code_label")}</Label>
                <Input id="postal_code" {...register("postal_code")} placeholder="98714" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("city_label")}</Label>
                <Input id="city" {...register("city")} placeholder="Papeete" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="island">{t("island_label")}</Label>
                <Input id="island" {...register("island")} placeholder="Tahiti" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("section_settings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Controller
                name="portal_enabled"
                control={control}
                render={({ field }) => (
                  <Switch id="portal_enabled" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="portal_enabled">{t("portal_enabled_label")}</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_terms">{t("payment_terms_label")}</Label>
              <Input id="payment_terms" type="number" min="0" max="365" {...register("payment_terms", { valueAsNumber: true })} className="w-32" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes_label")}</Label>
              <Textarea id="notes" {...register("notes")} rows={3} />
            </div>
          </CardContent>
        </Card>

        {errors.root && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {errors.root.message}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{common(isEdit ? "save" : "creating")}</>
              : isEdit ? t("submit_save") : t("submit_create")}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>{common("cancel")}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
