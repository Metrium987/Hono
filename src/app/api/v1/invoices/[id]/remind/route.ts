import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { render } from "@react-email/components";
import React from "react";
import { InvoiceReminderEmail, type InvoiceReminderData } from "@/lib/email/invoice-reminder-email";
import { resend, DEFAULT_FROM as FROM } from "@/lib/email/resend";

const SUBJECTS: Record<number, (inv: string, team: string) => string> = {
  1: (inv, team) => `Rappel — Facture ${inv} — ${team}`,
  2: (inv, team) => `RELANCE — Facture ${inv} impayée — ${team}`,
  3: (inv, team) => `MISE EN DEMEURE — Facture ${inv} — ${team}`,
};

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, props: { params: Params }) {
  const { id: invoiceId } = await props.params;

  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");

    const body = await request.json().catch(() => ({}));
    const level = parseInt(String(body.level ?? 1)) as 1 | 2 | 3;
    const note: string | null = body.note ?? null;

    if (![1, 2, 3].includes(level)) {
      return NextResponse.json({ error: "level must be 1, 2 or 3" }, { status: 400 });
    }

    // Fetch invoice + customer + team
    const [{ data: invoice, error: invErr }, { data: team, error: teamErr }] = await Promise.all([
      auth.supabase
        .from("invoices")
        .select("id, invoice_number, total_ttc, due_date, status, customer:customer_id(id, contact_name, email)")
        .eq("id", invoiceId)
        .eq("team_id", teamId)
        .is("deleted_at", null)
        .single(),
      auth.supabase
        .from("teams")
        .select("name, email, phone, settings")
        .eq("id", teamId)
        .single(),
    ]);

    if (invErr || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (teamErr || !team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const customer = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer as { contact_name?: string; email?: string } | null;
    const toEmail = customer?.email;
    if (!toEmail) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 422 });
    }

    const daysOverdue = Math.max(0, Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / 86_400_000
    ));
    const settings = (team.settings as Record<string, number> | null) ?? {};
    const lateFee = level === 3 ? (settings.late_fee_fixed ?? 5000) : undefined;

    const emailData: InvoiceReminderData = {
      level,
      invoiceNumber: invoice.invoice_number,
      totalTtc: parseFloat(String(invoice.total_ttc || 0)),
      dueDate: new Date(invoice.due_date).toLocaleDateString("fr-FR"),
      daysOverdue,
      customerName: customer?.contact_name ?? "",
      teamName: team.name,
      teamEmail: team.email ?? null,
      teamPhone: team.phone ?? null,
      lateFee,
    };

    const html = await render(React.createElement(InvoiceReminderEmail, { data: emailData }));

    let emailSent = false;
    let emailError: string | null = null;

    if (resend) {
      const { error: sendErr } = await resend.emails.send({
        from: `${team.name} <${FROM}>`,
        to: [toEmail],
        subject: SUBJECTS[level](invoice.invoice_number, team.name),
        html,
      });
      if (sendErr) {
        emailError = sendErr.message;
      } else {
        emailSent = true;
      }
    } else {
      // Dev mode — log without sending
      console.warn(`[remind] Dev mode — email not sent (no RESEND_API_KEY). Would send level ${level} to ${toEmail}`);
      emailSent = true;
    }

    // Always record the reminder attempt
    const { data: reminder, error: reminderErr } = await auth.supabase
      .from("invoice_reminders")
      .insert({
        team_id: teamId,
        invoice_id: invoiceId,
        level,
        sent_by: auth.userId,
        email_to: toEmail,
        note,
      })
      .select("id, level, sent_at")
      .single();

    if (reminderErr) {
      return NextResponse.json({ error: "Failed to record reminder", detail: reminderErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      reminder,
    });
  });
}
