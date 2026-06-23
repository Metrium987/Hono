import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { getPortalSession } from "@/lib/portal/session";
import { resend, DEFAULT_FROM } from "@/lib/email/resend";

// POST /api/v1/portal/invoices/[id]/payment-proof
// Client submits proof of payment (bank transfer reference, amount, date)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { payment_date, amount, reference, notes } = body as {
    payment_date?: string;
    amount?: number | string;
    reference?: string;
    notes?: string;
  };

  if (!payment_date || !amount) {
    return NextResponse.json({ error: "Date et montant requis" }, { status: 400 });
  }

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const admin = createAdminClient();

  // Verify invoice belongs to this customer
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, team_id, status, total_ttc, paid_amount")
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .is("deleted_at", null)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  if (["paid", "cancelled", "refunded", "draft"].includes(invoice.status)) {
    return NextResponse.json({ error: "Cette facture ne nécessite pas de preuve de paiement" }, { status: 409 });
  }

  // Check for duplicate pending proof
  const { data: existing } = await admin
    .from("payment_proofs")
    .select("id")
    .eq("invoice_id", id)
    .eq("status", "pending")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Une preuve de paiement est déjà en attente de vérification pour cette facture" }, { status: 409 });
  }

  // Insert proof
  const { data: proof, error: proofErr } = await admin
    .from("payment_proofs")
    .insert({
      team_id: invoice.team_id,
      invoice_id: id,
      customer_id: session.customerId,
      payment_date,
      amount: parsedAmount,
      reference: reference?.trim() || null,
      notes: notes?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (proofErr || !proof) {
    return NextResponse.json({ error: proofErr?.message ?? "Erreur lors de l'enregistrement" }, { status: 500 });
  }

  // Notify staff by email (non-blocking)
  try {
    const { data: ownerRows } = await admin
      .from("team_members")
      .select("user:user_id(email)")
      .eq("team_id", invoice.team_id)
      .eq("is_owner", true)
      .limit(3);

    const { data: customer } = await admin
      .from("customers")
      .select("contact_name, company_name")
      .eq("id", session.customerId)
      .single();

    const clientName = customer?.company_name ?? customer?.contact_name ?? "Client";
    const toEmails = (ownerRows ?? [])
      .map((r) => {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        return (u as { email: string } | null)?.email;
      })
      .filter(Boolean) as string[];

    if (resend && toEmails.length > 0) {
      const fmtAmount = parsedAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
      await resend.emails.send({
        from: DEFAULT_FROM,
        to: toEmails,
        subject: `💳 Preuve de paiement reçue — Facture ${invoice.invoice_number}`,
        html: `
          <p>Bonjour,</p>
          <p>Le client <strong>${clientName}</strong> a soumis une preuve de paiement pour la facture <strong>${invoice.invoice_number}</strong>.</p>
          <ul>
            <li>Montant déclaré : <strong>${fmtAmount} F</strong></li>
            <li>Date de paiement : <strong>${payment_date}</strong></li>
            ${reference ? `<li>Référence : ${reference}</li>` : ""}
            ${notes ? `<li>Notes : ${notes}</li>` : ""}
          </ul>
          <p>Connectez-vous à votre espace ERP pour vérifier et valider ce paiement.</p>
        `,
      });
    }
  } catch {
    // Non-critical
  }

  return NextResponse.json({ ok: true, proof_id: proof.id }, { status: 201 });
}
