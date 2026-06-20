import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { RemindersClient, RemindersStats, type ReminderInvoice } from "./reminders-client";

function daysDiff(dateStr: string): number {
  const due = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

type Reminder = { level: number; sent_at: string };

function getNextAction(reminders: Reminder[]): { level: 1 | 2 | 3 | null; label: string; disabled: boolean } {
  if (!reminders.length) {
    return { level: 1, label: "Rappel amiable", disabled: false };
  }
  const sorted = [...reminders].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  const last = sorted[0];
  const daysSince = Math.floor((Date.now() - new Date(last.sent_at).getTime()) / 86_400_000);

  if (last.level === 1) {
    if (daysSince < 15) return { level: null, label: `Relance ferme dans ${15 - daysSince}j`, disabled: true };
    return { level: 2, label: "Relance ferme", disabled: false };
  }
  if (last.level === 2) {
    if (daysSince < 15) return { level: null, label: `Mise en demeure dans ${15 - daysSince}j`, disabled: true };
    return { level: 3, label: "Mise en demeure", disabled: false };
  }
  return { level: null, label: "Action juridique requise", disabled: true };
}

export default async function RemindersPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div>Non connecté</div>;

  const { data: memberships } = await supabase
    .from("team_members").select("team_id").eq("user_id", user.id).limit(1);
  const teamId = memberships?.[0]?.team_id;
  if (!teamId) return <div>Aucune équipe</div>;

  const today = new Date().toISOString().split("T")[0];

  const { data: rawInvoices } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, total_ttc, due_date, status,
      customer:customer_id(id, contact_name, email),
      reminders:invoice_reminders(id, level, sent_at)
    `)
    .eq("team_id", teamId)
    .in("status", ["overdue", "sent"])
    .lte("due_date", today)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });

  const invoices: ReminderInvoice[] = (rawInvoices ?? []).map((inv) => {
    const customer = Array.isArray(inv.customer) ? inv.customer[0] : inv.customer as { contact_name?: string; email?: string } | null;
    const reminders: Reminder[] = Array.isArray(inv.reminders) ? inv.reminders : [];
    const sorted = [...reminders].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    const lastReminder = sorted[0] ?? null;
    const next = getNextAction(reminders);

    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      total_ttc: parseFloat(String(inv.total_ttc || 0)),
      due_date: inv.due_date,
      status: inv.status,
      daysOverdue: daysDiff(inv.due_date),
      customerName: customer?.contact_name ?? "—",
      customerEmail: customer?.email ?? null,
      lastReminder,
      nextLevel: next.level,
      nextLabel: next.label,
      nextDisabled: next.disabled,
    };
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relances clients</h1>
        <p className="text-sm text-muted-foreground">Factures en retard de paiement — relances par email en 3 niveaux</p>
      </div>

      <RemindersStats invoices={invoices} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">
            {invoices.length > 0
              ? `${invoices.length} facture${invoices.length > 1 ? "s" : ""} à traiter`
              : "Aucune facture en retard"}
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Niveau 1 — Rappel amiable</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" /> Niveau 2 — Relance ferme</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-700" /> Niveau 3 — Mise en demeure</span>
          </div>
        </div>
        <RemindersClient invoices={invoices} teamId={teamId} />
      </div>
    </div>
  );
}
