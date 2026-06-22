import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resend, DEFAULT_FROM as FROM } from "@/lib/email/resend";
import { render } from "@react-email/components";
import React from "react";
import { InvoiceReminderEmail, type InvoiceReminderData } from "@/lib/email/invoice-reminder-email";

// GET /api/cron/auto-remind
// Appelée quotidiennement par Vercel Cron (vercel.json → "0 18 * * *" = 08h Tahiti)
// Sécurisée par Authorization: Bearer CRON_SECRET
export const maxDuration = 60;

const COOLDOWN_DAYS = 14;
const MAX_LEVEL = 3;

const LEVEL_SUBJECTS: Record<number, string> = {
  1: "Rappel",
  2: "Relance",
  3: "Dernier avertissement",
};


export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split("T")[0];
  const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS * 86_400_000).toISOString();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, total_ttc, due_date, team_id,
      customer:customer_id(contact_name, company_name, email),
      team:team_id(name, email, phone, settings),
      reminders:invoice_reminders(level, sent_at)
    `)
    .in("status", ["sent", "overdue"])
    .lt("due_date", today)
    .is("deleted_at", null)
    .order("due_date", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[cron/auto-remind] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type CustomerShape = { contact_name?: string; company_name?: string; email?: string };
  type TeamShape = { name?: string; email?: string; phone?: string; settings?: Record<string, number> };
  type ReminderShape = { level: number; sent_at: string };

  const results = await Promise.allSettled(
    (invoices ?? []).map(async (inv): Promise<"sent" | "skipped"> => {
      const customer: CustomerShape | null = Array.isArray(inv.customer) ? inv.customer[0] : (inv.customer as CustomerShape | null);
      const team: TeamShape | null = Array.isArray(inv.team) ? inv.team[0] : (inv.team as TeamShape | null);
      const reminders: ReminderShape[] = Array.isArray(inv.reminders) ? inv.reminders : [];

      if (!customer?.email || !resend) return "skipped";

      const lastReminder = reminders
        .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0] ?? null;

      if (lastReminder && lastReminder.level >= MAX_LEVEL) return "skipped";
      if (lastReminder && lastReminder.sent_at > cooldownDate) return "skipped";

      const nextLevel = (lastReminder ? lastReminder.level + 1 : 1) as 1 | 2 | 3;
      const daysOverdue = Math.max(0, Math.floor(
        (Date.now() - new Date(inv.due_date).getTime()) / 86_400_000
      ));

      const emailData: InvoiceReminderData = {
        level: nextLevel,
        invoiceNumber: inv.invoice_number,
        totalTtc: parseFloat(String(inv.total_ttc || 0)),
        dueDate: new Date(inv.due_date).toLocaleDateString("fr-FR"),
        daysOverdue,
        customerName: customer.company_name || customer.contact_name || "",
        teamName: team?.name ?? "",
        teamEmail: team?.email ?? null,
        teamPhone: team?.phone ?? null,
      };

      const html = await render(React.createElement(InvoiceReminderEmail, { data: emailData }));
      const subjectPrefix = LEVEL_SUBJECTS[nextLevel] ?? "Relance";

      const { error: sendErr } = await resend.emails.send({
        from: `${team?.name ?? "Hono"} <${FROM}>`,
        to: [customer.email],
        subject: `${subjectPrefix} — Facture ${inv.invoice_number} — ${team?.name ?? ""}`,
        html,
      });

      if (sendErr) {
        console.error(`[cron/auto-remind] send failed: ${inv.invoice_number}`, sendErr);
        return "skipped";
      }

      await supabase.from("invoice_reminders").insert({
        team_id: inv.team_id,
        invoice_id: inv.id,
        level: nextLevel,
        email_to: customer.email,
        note: `Relance automatique niveau ${nextLevel} (Vercel Cron — 08h Tahiti)`,
        sent_by: null,
      });

      return "sent";
    })
  );

  let sent = 0;
  let skipped = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value === "sent") sent++;
    else {
      skipped++;
      if (r.status === "rejected") console.error("[cron/auto-remind] error:", r.reason);
    }
  }

  console.info(`[cron/auto-remind] terminé : ${sent} envoyées, ${skipped} ignorées`);
  return NextResponse.json({ ok: true, sent, skipped });
}
