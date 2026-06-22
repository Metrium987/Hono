import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, RefreshCw, Pause, Play, Trash2 } from "lucide-react";
import { RecurringClient } from "./recurring-client";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Hebdomadaire",
  monthly_date: "Mensuelle",
  monthly_weekday: "Mensuelle (jour)",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
  custom: "Personnalisée",
};

export default async function RecurringInvoicesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: memberships } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) notFound();

  const { data: recurring } = await supabase
    .from("recurring_invoices")
    .select(`
      *,
      customer:customer_id(id, contact_name, company_name),
      currency:currency_id(code, symbol),
      items:recurring_invoice_items(description, quantity, unit_price_ht)
    `)
    .eq("team_id", teamId)
    .order("next_generation_date", { ascending: true });

  const { data: currencies } = await supabase
    .from("currencies").select("id, code, symbol").eq("team_id", teamId);
  const { data: customers } = await supabase
    .from("customers").select("id, contact_name, company_name").eq("team_id", teamId).order("contact_name");
  const { data: taxRates } = await supabase
    .from("tax_rates").select("id, name, rate").eq("team_id", teamId);

  return (
    <RecurringClient
      initialData={recurring ?? []}
      teamId={teamId}
      currencies={currencies ?? []}
      customers={customers ?? []}
      taxRates={taxRates ?? []}
      freqLabels={FREQ_LABELS}
    />
  );
}
