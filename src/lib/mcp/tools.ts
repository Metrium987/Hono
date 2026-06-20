import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type Permissions = Record<string, string[]>;

function can(permissions: Permissions | undefined, module: string, action: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  return permissions?.[module]?.includes(action) ?? false;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}

export function registerTools(
  server: McpServer,
  supabase: SupabaseClient,
  teamId: string,
  permissions: Permissions | undefined,
  isOwner: boolean
) {
  // ── Products ────────────────────────────────────────────────────────
  if (can(permissions, "catalog", "read", isOwner)) {
    server.tool(
      "list_products",
      "Liste les produits actifs du catalogue.",
      { search: z.string().optional().describe("Filtre par nom ou SKU") },
      async ({ search }) => {
        let q = supabase.from("products").select("id, name, description, price_ht, sku, type, current_stock, is_active").eq("team_id", teamId).eq("is_active", true).order("name");
        if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
        const { data, error } = await q.limit(50);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "get_product",
      "Détails d'un produit.",
      { id: z.string().describe("UUID du produit") },
      async ({ id }) => {
        const { data, error } = await supabase.from("products").select("*, category:category_id(name), translations:product_translations(*)").eq("id", id).eq("team_id", teamId).single();
        if (error || !data) return textResult("Produit introuvable.");
        return jsonResult(data);
      }
    );
  }

  // ── Customers ────────────────────────────────────────────────────────
  if (can(permissions, "customers", "read", isOwner)) {
    server.tool(
      "list_customers",
      "Liste les clients.",
      { search: z.string().optional().describe("Filtre par nom, email ou N° Tahiti") },
      async ({ search }) => {
        let q = supabase.from("customers").select("id, company_name, contact_name, email, phone, n_tahiti, is_b2b").eq("team_id", teamId).order("company_name");
        if (search) q = q.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
        const { data, error } = await q.limit(50);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "get_customer",
      "Détails d'un client.",
      { id: z.string().describe("UUID du client") },
      async ({ id }) => {
        const { data, error } = await supabase.from("customers").select("*").eq("id", id).eq("team_id", teamId).single();
        if (error || !data) return textResult("Client introuvable.");
        return jsonResult(data);
      }
    );
  }

  // ── Quotes ────────────────────────────────────────────────────────
  if (can(permissions, "quotes", "read", isOwner)) {
    server.tool(
      "list_quotes",
      "Liste les devis.",
      {
        status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).optional(),
        customer_id: z.string().optional()
      },
      async ({ status, customer_id }) => {
        let q = supabase.from("quotes").select("id, quote_number, status, total_ttc, issue_date, customer:customer_id(company_name, contact_name)").eq("team_id", teamId).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        if (customer_id) q = q.eq("customer_id", customer_id);
        const { data, error } = await q.limit(20);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "get_quote",
      "Détails d'un devis.",
      { id: z.string() },
      async ({ id }) => {
        const { data, error } = await supabase.from("quotes").select("*, customer:customer_id(*), items:quote_items(*, tax_rates:tax_rate_id(name, rate)), currency:currency_id(code, symbol)").eq("id", id).eq("team_id", teamId).single();
        if (error || !data) return textResult("Devis introuvable.");
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "quotes", "write", isOwner)) {
    server.tool(
      "create_quote",
      "Crée un nouveau devis. Retourne le devis créé avec son numéro.",
      {
        customer_id: z.string().describe("UUID du client"),
        currency_id: z.string().describe("UUID de la devise"),
        issue_date: z.string().describe("Date d'émission au format YYYY-MM-DD"),
        valid_until: z.string().optional().describe("Date de validité YYYY-MM-DD"),
        notes: z.string().optional(),
        items: z.array(z.object({
          description: z.string(),
          quantity: z.number().positive(),
          unit_price_ht: z.number().nonnegative(),
          tax_rate_id: z.string().nullable().optional(),
        })).min(1).describe("Lignes du devis")
      },
      async ({ customer_id, currency_id, issue_date, valid_until, notes, items }) => {
        // Validate customer belongs to team
        const { data: customer } = await supabase.from("customers").select("id").eq("id", customer_id).eq("team_id", teamId).single();
        if (!customer) return textResult("Erreur : Le client spécifié n'existe pas ou n'appartient pas à votre équipe.");

        // Validate currency belongs to team
        const { data: currency } = await supabase.from("currencies").select("id").eq("id", currency_id).eq("team_id", teamId).single();
        if (!currency) return textResult("Erreur : La devise spécifiée n'existe pas ou n'appartient pas à votre équipe.");

        const { data: quote, error: qErr } = await supabase.rpc("generate_next_quote_number", { p_team_id: teamId });
        if (qErr) return textResult(`Erreur numérotation : ${qErr.message}`);

        const lineItems = items.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price_ht: item.unit_price_ht,
          line_total_ht: item.quantity * item.unit_price_ht,
          tax_rate_id: item.tax_rate_id ?? null,
          sort_order: i,
        }));
        const subtotal_ht = lineItems.reduce((s, i) => s + Number(i.line_total_ht), 0);

        // Fetch tax rates in batch
        const taxRateIds = [...new Set(items.filter(i => i.tax_rate_id).map(i => i.tax_rate_id))];
        const taxRateMap = new Map<string, number>();
        if (taxRateIds.length > 0) {
          const { data: rates } = await supabase
            .from("tax_rates")
            .select("id, rate")
            .eq("team_id", teamId)
            .in("id", taxRateIds);
          rates?.forEach(r => taxRateMap.set(r.id, r.rate));
        }

        let tax_amount = 0;
        for (const item of lineItems) {
          if (item.tax_rate_id) {
            const rateVal = taxRateMap.get(item.tax_rate_id) ?? 0;
            tax_amount += item.line_total_ht * (rateVal / 100);
          }
        }
        const total_ttc = subtotal_ht + tax_amount;

        const { data: newQuote, error: insertErr } = await supabase.from("quotes").insert({
          team_id: teamId,
          customer_id,
          currency_id,
          quote_number: quote,
          status: "draft",
          issue_date,
          valid_until: valid_until ?? null,
          notes: notes ?? null,
          subtotal_ht: Math.round(subtotal_ht * 100) / 100,
          tax_amount: Math.round(tax_amount * 100) / 100,
          total_ttc: Math.round(total_ttc * 100) / 100,
        }).select("id, quote_number").single();

        if (insertErr || !newQuote) return textResult(`Erreur création : ${insertErr?.message}`);

        const { error: itemsErr } = await supabase.from("quote_items").insert(lineItems.map(li => ({ ...li, quote_id: newQuote.id })));
        if (itemsErr) {
          await supabase.from("quotes").delete().eq("id", newQuote.id);
          return textResult(`Erreur création lignes : ${itemsErr.message}`);
        }

        return textResult(`Devis ${newQuote.quote_number} créé avec succès. ID : ${newQuote.id}`);
      }
    );
  }

  if (can(permissions, "quotes", "write", isOwner)) {
    server.tool(
      "convert_quote_to_invoice",
      "Convertit un devis accepté en facture.",
      { quote_id: z.string() },
      async ({ quote_id }) => {
        const { data, error } = await supabase.rpc("convert_quote_to_invoice", { p_quote_id: quote_id, p_team_id: teamId });
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Facture créée avec succès. Résultat : ${JSON.stringify(data)}`);
      }
    );
  }

  // ── Invoices ────────────────────────────────────────────────────────
  if (can(permissions, "invoices", "read", isOwner)) {
    server.tool(
      "list_invoices",
      "Liste les factures.",
      {
        status: z.enum(["draft", "sent", "partial", "paid", "overdue", "cancelled"]).optional(),
        customer_id: z.string().optional()
      },
      async ({ status, customer_id }) => {
        let q = supabase.from("invoices").select("id, invoice_number, status, total_ttc, paid_amount, issue_date, due_date, customer:customer_id(company_name, contact_name)").eq("team_id", teamId).is("deleted_at", null).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        if (customer_id) q = q.eq("customer_id", customer_id);
        const { data, error } = await q.limit(20);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "get_invoice",
      "Détails d'une facture.",
      { id: z.string() },
      async ({ id }) => {
        const { data, error } = await supabase.from("invoices").select("*, customer:customer_id(*), items:invoice_items(*, tax_rates:tax_rate_id(name, rate)), currency:currency_id(code, symbol)").eq("id", id).eq("team_id", teamId).is("deleted_at", null).single();
        if (error || !data) return textResult("Facture introuvable.");
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "invoices", "write", isOwner)) {
    server.tool(
      "record_payment",
      "Enregistre un paiement sur une facture.",
      {
        invoice_id: z.string(),
        amount: z.number().positive(),
        payment_date: z.string().describe("YYYY-MM-DD"),
        payment_method_id: z.string().optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ invoice_id, amount, payment_date, payment_method_id, reference, notes }) => {
        // Verify invoice exists and belongs to the team
        const { data: invoice, error: invError } = await supabase
          .from("invoices")
          .select("id")
          .eq("id", invoice_id)
          .eq("team_id", teamId)
          .single();

        if (invError || !invoice) {
          return textResult("Erreur : Facture introuvable ou n'appartient pas à votre équipe.");
        }

        const { error } = await supabase.from("invoice_payments").insert({
          invoice_id,
          team_id: teamId,
          amount,
          payment_date,
          payment_method_id: payment_method_id ?? null,
          reference: reference ?? null,
          notes: notes ?? null,
        });
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Paiement de ${amount} enregistré sur la facture ${invoice_id}.`);
      }
    );
  }

  // ── Orders ────────────────────────────────────────────────────────
  if (can(permissions, "orders", "read", isOwner)) {
    server.tool(
      "list_orders",
      "Liste les commandes du portail client.",
      {
        status: z.enum(["pending", "processing", "completed", "cancelled"]).optional()
      },
      async ({ status }) => {
        let q = supabase.from("orders").select("id, status, notes, created_at, customer:customer_id(company_name, contact_name)").eq("team_id", teamId).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q.limit(20);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "orders", "write", isOwner)) {
    server.tool(
      "update_order_status",
      "Met à jour le statut d'une commande.",
      {
        order_id: z.string(),
        status: z.enum(["pending", "processing", "completed", "cancelled"]),
      },
      async ({ order_id, status }) => {
        const { error } = await supabase.from("orders").update({ status }).eq("id", order_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Commande ${order_id} mise à jour → ${status}.`);
      }
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────
  if (can(permissions, "reports", "read", isOwner)) {
    server.tool(
      "get_dashboard_summary",
      "Résumé financier : revenus du mois, factures impayées, commandes en attente.",
      {},
      async () => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const [invoicesRes, ordersRes] = await Promise.all([
          supabase.from("invoices").select("status, total_ttc, paid_amount").eq("team_id", teamId).is("deleted_at", null),
          supabase.from("orders").select("status").eq("team_id", teamId),
        ]);

        const invoices = invoicesRes.data ?? [];
        const orders = ordersRes.data ?? [];

        const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s: number, i) => s + Number(i.total_ttc ?? 0), 0);
        const outstanding = invoices.filter(i => ["sent", "partial", "overdue"].includes(i.status)).reduce((s: number, i) => s + (Number(i.total_ttc ?? 0) - Number(i.paid_amount ?? 0)), 0);
        const pendingOrders = orders.filter(o => o.status === "pending").length;

        return jsonResult({
          total_revenue_xpf: totalRevenue,
          outstanding_xpf: outstanding,
          pending_orders: pendingOrders,
          invoice_count_by_status: invoices.reduce((acc: Record<string, number>, i) => { acc[i.status] = (acc[i.status] ?? 0) + 1; return acc; }, {}),
        });
      }
    );
  }
}
