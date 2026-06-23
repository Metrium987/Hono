import { NextRequest, NextResponse } from "next/server";
import { withAuth, requirePermission } from "@/lib/auth/api-auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

// GET /api/v1/reports?type=pnl|vat|client-statement&date_from=...&date_to=...&customer_id=...
export async function GET(request: NextRequest) {
  return withAuth(request, async (auth, teamId, params) => {
    requirePermission(auth, "reports", "read");
    const type = params.get("type") ?? "pnl";
    const dateFrom = params.get("date_from") ?? new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    const dateTo = params.get("date_to") ?? new Date().toISOString().split("T")[0];
    const customerId = params.get("customer_id");
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    switch (type) {
      case "pnl":
        return handlePnl(supabase, teamId, dateFrom, dateTo);
      case "vat":
        return handleVatByRate(supabase, teamId, dateFrom, dateTo);
      case "client-statement":
        if (!customerId) {
          return NextResponse.json({ error: "customer_id is required for client-statement report" }, { status: 400 });
        }
        return handleClientStatement(supabase, teamId, customerId, dateFrom, dateTo);
      case "ar-aging":
        return handleArAging(supabase, teamId);
      default:
        return NextResponse.json({ error: `Unknown report type: ${type}` }, { status: 400 });
    }
  });
}

// ---------- AR Aging Report ----------
async function handleArAging(supabase: ReturnType<typeof createClient>, teamId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: ars } = await supabase
    .from("account_receivables")
    .select("id, total_amount, paid_amount, balance, due_date, status, customer:customer_id(company_name, contact_name)")
    .eq("team_id", teamId)
    .neq("status", "paid")
    .neq("status", "written_off")
    .order("due_date", { ascending: true });

  const buckets = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 };
  const byCustomer = new Map<string, { name: string; balance: number }>();

  for (const ar of ars ?? []) {
    const balance = parseFloat(String(ar.balance)) || 0;
    const daysOverdue = Math.floor((new Date(today).getTime() - new Date(ar.due_date).getTime()) / 86400000);

    if (daysOverdue <= 0) buckets.current += balance;
    else if (daysOverdue <= 30) buckets.d30 += balance;
    else if (daysOverdue <= 60) buckets.d60 += balance;
    else if (daysOverdue <= 90) buckets.d90 += balance;
    else buckets.over90 += balance;

    const rawCustomer = ar.customer;
    const cust = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
    const custName = (cust as { company_name?: string; contact_name?: string } | null)?.company_name
      ?? (cust as { company_name?: string; contact_name?: string } | null)?.contact_name
      ?? ar.id;
    const existing = byCustomer.get(custName);
    byCustomer.set(custName, { name: custName, balance: (existing?.balance ?? 0) + balance });
  }

  const totalBalance = Object.values(buckets).reduce((s, v) => s + v, 0);

  return NextResponse.json({
    data: {
      as_of: today,
      total_balance: Math.round(totalBalance * 100) / 100,
      aging: {
        current: Math.round(buckets.current * 100) / 100,
        "1-30_days": Math.round(buckets.d30 * 100) / 100,
        "31-60_days": Math.round(buckets.d60 * 100) / 100,
        "61-90_days": Math.round(buckets.d90 * 100) / 100,
        "over_90_days": Math.round(buckets.over90 * 100) / 100,
      },
      by_customer: Array.from(byCustomer.values()).sort((a, b) => b.balance - a.balance),
    },
  });
}

// ---------- P&L Report ----------
async function handlePnl(supabase: ReturnType<typeof createClient>, teamId: string, dateFrom: string, dateTo: string) {
  const { data: invoiceRevenue } = await supabase
    .from("invoices")
    .select("total_ttc")
    .eq("team_id", teamId)
    .in("status", ["paid", "partial", "sent"])
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo);

  const totalInvoiced = (invoiceRevenue ?? []).reduce((sum: number, inv: { total_ttc: string }) => sum + parseFloat(inv.total_ttc || "0"), 0);

  const { data: otherIncome } = await supabase
    .from("income")
    .select("amount")
    .eq("team_id", teamId)
    .gte("income_date", dateFrom)
    .lte("income_date", dateTo);

  const totalOtherIncome = (otherIncome ?? []).reduce((sum: number, inc: { amount: string }) => sum + parseFloat(inc.amount || "0"), 0);

  // Get invoice IDs for this team in period, then get payments
  const { data: teamInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("team_id", teamId)
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo);

  const invoiceIds = (teamInvoices ?? []).map((inv) => inv.id);
  let totalCollected = 0;

  if (invoiceIds.length > 0) {
    const { data: payments } = await supabase
      .from("invoice_payments")
      .select("amount")
      .in("invoice_id", invoiceIds);

    totalCollected = (payments ?? []).reduce((sum: number, p: { amount: string }) => sum + parseFloat(p.amount || "0"), 0);
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, category:category_id(name)")
    .eq("team_id", teamId)
    .gte("expense_date", dateFrom)
    .lte("expense_date", dateTo);

  const totalExpenses = (expenses ?? []).reduce((sum: number, exp: { amount: string; category: { name: string }[] | null }) => sum + parseFloat(exp.amount || "0"), 0);

  const categoryMap = new Map<string, number>();
  for (const exp of (expenses ?? []) as Array<{ amount: string; category: { name: string }[] | null }>) {
    const cat = exp.category as { name: string }[] | null;
    const catName = cat?.[0]?.name as string ?? "Sans catégorie";
    categoryMap.set(catName, (categoryMap.get(catName) ?? 0) + parseFloat(exp.amount as string || "0"));
  }

  // Commissions versées dans la période (Phase 8.2)
  const { data: commissionsData } = await supabase
    .from("invoice_commissions")
    .select("amount, invoice:invoice_id(issue_date)")
    .eq("team_id", teamId)
    .eq("status", "paid");

  const totalCommissions = (commissionsData ?? []).reduce((sum: number, c: { amount: string }) => sum + parseFloat(String(c.amount) || "0"), 0);

  const totalRevenue = totalInvoiced + totalOtherIncome;
  const totalCosts = totalExpenses + totalCommissions;
  const netIncome = totalRevenue - totalCosts;

  return NextResponse.json({
    data: {
      period: { from: dateFrom, to: dateTo },
      revenue: {
        total_invoiced: totalInvoiced,
        total_collected: totalCollected,
        other_income: totalOtherIncome,
        total_revenue: totalRevenue,
      },
      expenses: { total: totalExpenses, by_category: Object.fromEntries(categoryMap) },
      commissions_paid: Math.round(totalCommissions * 100) / 100,
      net_income: Math.round(netIncome * 100) / 100,
      metrics: {
        profit_margin_percent: totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 100) : 0,
        expense_ratio_percent: totalRevenue > 0 ? Math.round((totalCosts / totalRevenue) * 100) : 0,
      },
    },
  });
}

// ---------- VAT by Rate Report ----------
async function handleVatByRate(supabase: ReturnType<typeof createClient>, teamId: string, dateFrom: string, dateTo: string) {
  const { data: taxRates } = await supabase
    .from("tax_rates")
    .select("id, name, rate")
    .eq("team_id", teamId);

  // Get invoice IDs in the date range first (avoid dot-notation join on invoice_items)
  const { data: vatInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("team_id", teamId)
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo);

  const vatInvoiceIds = (vatInvoices ?? []).map((inv) => inv.id);

  const rateBreakdown: Array<{ rate_id: string; name: string; rate: number; taxable_base: number; vat_amount: number }> = [];

  if (vatInvoiceIds.length > 0) {
    const ratePromises = (taxRates ?? []).map(async (tr) => {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("line_total_ht")
        .eq("tax_rate_id", tr.id)
        .in("invoice_id", vatInvoiceIds);

      const taxableBase = (items ?? []).reduce((sum: number, item: { line_total_ht: string }) => sum + parseFloat(item.line_total_ht || "0"), 0);
      const vatAmount = taxableBase * (parseFloat(tr.rate) / 100);

      return { tr, taxableBase, vatAmount };
    });

    const results = await Promise.all(ratePromises);

    for (const { tr, taxableBase, vatAmount } of results) {
      if (taxableBase > 0) {
        rateBreakdown.push({
          rate_id: tr.id,
          name: tr.name,
          rate: parseFloat(tr.rate),
          taxable_base: Math.round(taxableBase * 100) / 100,
          vat_amount: Math.round(vatAmount * 100) / 100,
        });
      }
    }
  }

  const totalVat = rateBreakdown.reduce((sum, r) => sum + r.vat_amount, 0);

  return NextResponse.json({
    data: {
      period: { from: dateFrom, to: dateTo },
      rates: rateBreakdown,
      total_vat: Math.round(totalVat * 100) / 100,
    },
  });
}

// ---------- Client Statement ----------
async function handleClientStatement(supabase: ReturnType<typeof createClient>, teamId: string, customerId: string, dateFrom: string, dateTo: string) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, company_name, contact_name, email, n_tahiti")
    .eq("id", customerId)
    .single();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_ttc, paid_amount, issue_date, due_date, currency:currency_id(symbol)")
    .eq("team_id", teamId)
    .eq("customer_id", customerId)
    .gte("issue_date", dateFrom)
    .lte("issue_date", dateTo)
    .is("deleted_at", null)
    .order("issue_date", { ascending: true });    // Get IDs of invoices for this customer, then get their payments
    const { data: customerInvoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("team_id", teamId)
      .eq("customer_id", customerId);

    const custInvoiceIds = (customerInvoices ?? []).map((inv) => inv.id);
    let payments: Array<{ amount: string; payment_date: string; reference: string | null; payment_method: { display_name: string; name: string }[] | null }> = [];

    if (custInvoiceIds.length > 0) {
      const { data: payData } = await supabase
        .from("invoice_payments")
        .select("amount, payment_date, reference, payment_method:payment_method_id(display_name, name)")
        .in("invoice_id", custInvoiceIds);

      payments = (payData ?? []) as Array<{ amount: string; payment_date: string; reference: string | null; payment_method: { display_name: string; name: string }[] | null }>;
    }

  const formattedInvoices = (invoices ?? []).map((inv: { id: string; invoice_number: string; status: string; total_ttc: string; paid_amount: string; issue_date: string; due_date: string; currency: { symbol: string }[] | null }) => ({
    id: inv.id,
    number: inv.invoice_number,
    status: inv.status,
    total_ttc: parseFloat(inv.total_ttc as string || "0"),
    paid: parseFloat(inv.paid_amount as string || "0"),
    remaining: parseFloat(inv.total_ttc as string || "0") - parseFloat(inv.paid_amount as string || "0"),
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    currency: (inv.currency as { symbol: string }[])?.[0]?.symbol ?? "F",
  }));

  const totalBilled = formattedInvoices.reduce((sum, inv) => sum + inv.total_ttc, 0);
  const totalPaid = formattedInvoices.reduce((sum, inv) => sum + inv.paid, 0);
  const totalRemaining = formattedInvoices.reduce((sum, inv) => sum + inv.remaining, 0);

  return NextResponse.json({
    data: {
      customer: customer ?? null,
      period: { from: dateFrom, to: dateTo },
      summary: { total_billed: totalBilled, total_paid: totalPaid, total_remaining: totalRemaining },
      invoices: formattedInvoices,
      payments: payments ?? [],
    },
  });
}
