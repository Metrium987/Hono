import { Resend } from "resend";
import { render } from "@react-email/components";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InvoiceEmail, type InvoiceEmailData } from "./invoice-email";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail =
  process.env.RESEND_FROM_EMAIL ?? "factures@votre-domaine.pf";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type SendInvoiceResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type SendInvoiceParams = {
  teamId: string;
  invoiceId: string;
  invoiceNumber: string;
  toEmail: string;
  teamName: string;
  emailData: InvoiceEmailData;
};

/**
 * Send an invoice email using Resend and record the attempt in the email_outbox table.
 */
export async function sendInvoiceEmail(
  supabase: SupabaseClient,
  params: SendInvoiceParams
): Promise<SendInvoiceResult> {
  const { teamId, invoiceId, invoiceNumber, toEmail, teamName, emailData } = params;

  if (!resend) {
    console.warn("RESEND_API_KEY not configured — email not sent. Skipping.");
    return { success: false, error: "Resend not configured" };
  }

  try {
    // Render the email template to HTML
    const html = await render(<InvoiceEmail data={emailData} />);

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: `${teamName} <${resendFromEmail}>`,
      to: [toEmail],
      subject: `Facture ${invoiceNumber} — ${teamName}`,
      html,
    });

    if (error) {
      console.error("Resend send error:", error);

      await recordOutbox(supabase, {
        teamId,
        invoiceId,
        invoiceNumber,
        teamName,
        toEmail,
        kind: "invoice_sent",
        status: "failed",
        error: error.message,
      });

      return { success: false, error: error.message };
    }

    // Record success in email_outbox
    await recordOutbox(supabase, {
      teamId,
      invoiceId,
      invoiceNumber,
      teamName,
      toEmail,
      kind: "invoice_sent",
      status: "sent",
      messageId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sendInvoiceEmail error:", err);

    await recordOutbox(supabase, {
      teamId,
      invoiceId,
      invoiceNumber,
      teamName,
      toEmail,
      kind: "invoice_sent",
      status: "failed",
      error: message,
    });

    return { success: false, error: message };
  }
}

// ── Internal helpers ──

type OutboxParams = {
  teamId: string;
  invoiceId: string;
  invoiceNumber: string;
  teamName: string;
  toEmail: string;
  kind: string;
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
};

async function recordOutbox(supabase: SupabaseClient, params: OutboxParams) {
  const {
    teamId, invoiceId, invoiceNumber, teamName,
    toEmail, kind, status, messageId, error,
  } = params;

  try {
    await supabase.from("email_outbox").insert({
      team_id: teamId,
      kind,
      to_email: toEmail,
      subject: `Facture ${invoiceNumber} — ${teamName}`,
      related_type: "invoice",
      related_id: invoiceId,
      status,
      message_id: messageId ?? null,
      last_error: error ?? null,
      last_attempted_at: new Date().toISOString(),
      sent_at: status === "sent" ? new Date().toISOString() : null,
      next_attempt_at: status === "failed"
        ? new Date(Date.now() + 3600000).toISOString()
        : null,
    });
  } catch (dbError) {
    // Non-critical — logging the outbox failure shouldn't fail the email send
    console.error("Failed to record email_outbox entry:", dbError);
  }
}
