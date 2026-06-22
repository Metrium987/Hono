import { NextRequest, NextResponse } from "next/server";
import { withAuth, hasPermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    // Allow search if user has at least one of the relevant module permissions
    const canSearch = auth.isOwner ||
      hasPermission(auth, "invoices", "read") ||
      hasPermission(auth, "clients", "read") ||
      hasPermission(auth, "catalog", "read");
    if (!canSearch) {
      return NextResponse.json({ customers: [], invoices: [], products: [] });
    }
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ customers: [], invoices: [], products: [] });

    const pattern = `%${q}%`;

    const [customersRes, invoicesRes, productsRes] = await Promise.all([
      auth.supabase
        .from("customers")
        .select("id, contact_name, company_name, customer_type")
        .eq("team_id", teamId)
        .or(`contact_name.ilike.${pattern},company_name.ilike.${pattern}`)
        .limit(5),
      auth.supabase
        .from("invoices")
        .select("id, invoice_number, status, total_ttc, customer:customer_id(contact_name, company_name)")
        .eq("team_id", teamId)
        .is("deleted_at", null)
        .ilike("invoice_number", pattern)
        .limit(5),
      auth.supabase
        .from("products")
        .select("id, name, price_ht, is_published")
        .eq("team_id", teamId)
        .ilike("name", pattern)
        .limit(5),
    ]);

    return NextResponse.json({
      customers: customersRes.data ?? [],
      invoices: invoicesRes.data ?? [],
      products: productsRes.data ?? [],
    });
  });
}
