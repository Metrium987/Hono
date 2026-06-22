import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission, hasPermission } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId) => {
    // Allow search if user has at least one of the relevant module permissions
    if (!auth.isOwner &&
      !hasPermission(auth, "invoices", "read") &&
      !hasPermission(auth, "clients", "read") &&
      !hasPermission(auth, "catalog", "read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = new URL(request.url);
    const raw = url.searchParams.get("q")?.trim() ?? "";
    // Sanitiser les caractères spéciaux PostgREST avant interpolation dans .or()
    const q = raw.replace(/[,()'"]/g, "");
    if (q.length < 2) return NextResponse.json({ customers: [], invoices: [], products: [] });

    const pattern = `%${q}%`;

    const canClients = auth.isOwner || hasPermission(auth, "clients", "read");
    const canInvoices = auth.isOwner || hasPermission(auth, "invoices", "read");
    const canCatalog = auth.isOwner || hasPermission(auth, "catalog", "read");

    const [customersRes, invoicesRes, productsRes] = await Promise.all([
      canClients
        ? auth.supabase
            .from("customers")
            .select("id, contact_name, company_name, customer_type")
            .eq("team_id", teamId)
            .or(`contact_name.ilike.${pattern},company_name.ilike.${pattern}`)
            .limit(5)
        : Promise.resolve({ data: [] }),
      canInvoices
        ? auth.supabase
            .from("invoices")
            .select("id, invoice_number, status, total_ttc, customer:customer_id(contact_name, company_name)")
            .eq("team_id", teamId)
            .is("deleted_at", null)
            .ilike("invoice_number", pattern)
            .limit(5)
        : Promise.resolve({ data: [] }),
      canCatalog
        ? auth.supabase
            .from("products")
            .select("id, name, price_ht, is_published")
            .eq("team_id", teamId)
            .ilike("name", pattern)
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json({
      customers: customersRes.data ?? [],
      invoices: invoicesRes.data ?? [],
      products: productsRes.data ?? [],
    });
  });
}
