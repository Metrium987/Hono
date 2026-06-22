import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { paymentId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "read");

    const { data, error } = await auth.supabase
      .from("payment_evidence")
      .select("id, payment_id, evidence_url, evidence_type, uploaded_by, created_at")
      .eq("payment_id", paymentId)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data });
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { paymentId } = await params;
  return withAuth(request, async (auth, teamId) => {
    requirePermission(auth, "invoices", "write");
    const body = await request.json();
    const { evidence_url, evidence_type } = body;

    if (!evidence_url?.trim()) return NextResponse.json({ error: "evidence_url is required" }, { status: 400 });

    const validTypes = ["image", "pdf", "document"] as const;
    const etype = evidence_type ?? "image";
    if (!validTypes.includes(etype)) {
      return NextResponse.json({ error: "evidence_type must be image, pdf, or document" }, { status: 400 });
    }

    const { data: payment } = await auth.supabase
      .from("invoice_payments")
      .select("id")
      .eq("id", paymentId)
      .eq("team_id", teamId)
      .single();

    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    const { data, error } = await auth.supabase
      .from("payment_evidence")
      .insert({
        team_id: teamId,
        payment_id: paymentId,
        evidence_url: evidence_url.trim(),
        evidence_type: etype,
        uploaded_by: auth.userId,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ data }, { status: 201 });
  });
}
