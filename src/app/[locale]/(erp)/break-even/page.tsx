import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { BreakEvenClient, type BreakEvenExpense, type MonthlyCA } from "./break-even-client";
import { checkPagePermission } from "@/lib/auth/page-auth";
import { ForbiddenPage } from "@/components/erp/forbidden-page";

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default async function BreakEvenPage() {
  const perm = await checkPagePermission("reports", "read");
  if (!perm.allowed) return <ForbiddenPage module="reports" />;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const teamId = perm.teamId;

  const now = new Date();
  const yearStart = `${now.getFullYear()}-01-01`;
  const today = now.toISOString().split("T")[0];

  const [{ data: expenseRows }, { data: paidPayments }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, description, vendor_name, amount, expense_date, is_fixed_cost")
      .eq("team_id", teamId)
      .gte("expense_date", yearStart)
      .lte("expense_date", today)
      .order("expense_date", { ascending: true }),
    // Use invoice_payments for actual CA (cash in)
    supabase
      .from("invoice_payments")
      .select("amount, payment_date, invoice:invoice_id(team_id)")
      .gte("payment_date", yearStart)
      .lte("payment_date", today),
  ]);

  // Filter payments to this team
  const teamPayments = (paidPayments ?? []).filter(
    (p) => (Array.isArray(p.invoice) ? p.invoice[0] : p.invoice as { team_id?: string } | null)?.team_id === teamId
  );

  // Monthly CA from invoice payments
  const monthlyCA: MonthlyCA[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1);
    if (d > now) return null;
    const key = `${d.getFullYear()}-${String(i + 1).padStart(2, "0")}`;
    const ca = teamPayments
      .filter((p) => p.payment_date?.startsWith(key))
      .reduce((s, p) => s + parseFloat(String(p.amount || 0)), 0);
    return { month: MONTHS[i], key, ca: Math.round(ca) };
  }).filter((m): m is MonthlyCA => m !== null && m.ca > 0 || true).filter((m): m is MonthlyCA => m !== null);

  const expenses: BreakEvenExpense[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    vendor_name: e.vendor_name ?? null,
    amount: parseFloat(String(e.amount || 0)),
    expense_date: e.expense_date,
    is_fixed_cost: e.is_fixed_cost ?? false,
  }));

  const year = now.getFullYear();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Seuil de rentabilité {year}</h1>
        <p className="text-sm text-muted-foreground">
          Classez vos dépenses en charges fixes ou variables pour calculer automatiquement votre point mort
        </p>
      </div>

      <BreakEvenClient expenses={expenses} monthlyCA={monthlyCA} teamId={teamId} />
    </div>
  );
}
