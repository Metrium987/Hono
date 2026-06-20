"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  payment_method: { id: string; name: string; display_name: string | null } | null;
};

type PaymentsListProps = {
  payments: Payment[];
  currencySymbol: string;
  invoiceId: string;
};

export function PaymentsList({ payments, currencySymbol, invoiceId }: PaymentsListProps) {
  const t = useTranslations("invoice_detail");
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t("no_payments")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((p) => {
        const pm = p.payment_method as Payment["payment_method"] | null;
        return (
          <div key={p.id as string} className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {(p.amount as number).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {currencySymbol}
                </span>
                {pm && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {pm.display_name ?? pm.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(p.payment_date as string).toLocaleDateString("fr-FR")}
                {p.reference ? <> — {p.reference as string}</> : null}
              </p>
              {p.notes ? <p className="text-xs text-muted-foreground">{p.notes as string}</p> : null}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a href={`/api/v1/payments/${p.id}/receipt`} target="_blank">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
