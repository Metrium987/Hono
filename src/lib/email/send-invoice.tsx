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
 *
 * Uses a transactional pattern:
 * 1. INSERT a 'pending' outbox record FIRST (ensures trace even if process crashes)
 * 2. Send via Resend
 * 3. UPDATE record to 'sent' or 'failed'
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

  // 1. Insert a 'pending' outbox record FIRST — ensures legal trace even if crash occurs
  const outboxId = await createPendingOutboxRecord(supabase, {
    teamId,
    invoiceId,
    invoiceNumber,
    teamName,
    toEmail,
  });

  if (!outboxId) {
    console.error("Failed to create pending outbox record — aborting send");
    return { success: false, error: "Failed to create outbox trace" };
  }

  try {
    // Render the email template to HTML
    const html = await render(<InvoiceEmail data={emailData} />);

    // 2. Send via Resend
    const { data, error } = await resend.emails.send({
      from: `${teamName} <${resendFromEmail}>`,
      to: [toEmail],
      subject: `Facture ${invoiceNumber} — ${teamName}`,
      html,
    });

    if (error) {
      console.error("Resend send error:", error);

      // 3. UPDATE to failed
      await updateOutboxStatus(supabase, outboxId, {
        status: "failed",
        error: error.message,
      });

      return { success: false, error: error.message };
    }

    // 3. UPDATE to sent
    await updateOutboxStatus(supabase, outboxId, {
      status: "sent",
      messageId: data?.id,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("sendInvoiceEmail error:", err);

    // 3. UPDATE to failed
    await updateOutboxStatus(supabase, outboxId, {
      status: "failed",
      error: message,
    });

    return { success: false, error: message };
  }
}

// ── Internal helpers ──

type PendingOutboxParams = {
  teamId: string;
  invoiceId: string;
  invoiceNumber: string;
  teamName: string;
  toEmail: string;
};

/**
 * Insert a 'pending' email_outbox record BEFORE attempting the Resend call.
 * Returns the record ID, or null if the insert failed.
 */
async function createPendingOutboxRecord(
  supabase: SupabaseClient,
  params: PendingOutboxParams
): Promise<string | null> {
  const { teamId, invoiceId, invoiceNumber, teamName, toEmail } = params;

  try {
    const { data, error } = await supabase
      .from("email_outbox")
      .insert({
        team_id: teamId,
        kind: "invoice_sent",
        to_email: toEmail,
        subject: `Facture ${invoiceNumber} — ${teamName}`,
        related_type: "invoice",
        related_id: invoiceId,
        status: "pending",
        last_attempted_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create pending outbox record:", error);
      return null;
    }

    return data.id;
  } catch (dbError) {
    console.error("Failed to create pending outbox record:", dbError);
    return null;
  }
}

/**
 * Update an existing email_outbox record with the final status after Resend completes.
 */
async function updateOutboxStatus(
  supabase: SupabaseClient,
  id: string,
  params: { status: "sent" | "failed"; messageId?: string; error?: string }
) {
  const { status, messageId, error } = params;

  try {
    await supabase
      .from("email_outbox")
      .update({
        status,
        message_id: messageId ?? null,
        last_error: error ?? null,
        last_attempted_at: new Date().toISOString(),
        sent_at: status === "sent" ? new Date().toISOString() : null,
        next_attempt_at: status === "failed"
          ? new Date(Date.now() + 3600000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (dbError) {
    // Non-critical — failing to update the outbox shouldn't propagate
    console.error("Failed to update email_outbox status:", dbError);
  }
}
