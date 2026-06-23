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
        if (search) { const s = search.replace(/[,()'";%_]/g, ""); if (s) q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%`); }
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
        if (search) { const s = search.replace(/[,()'";%_]/g, ""); if (s) q = q.or(`company_name.ilike.%${s}%,contact_name.ilike.%${s}%,email.ilike.%${s}%`); }
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
        const { data, error } = await supabase.from("customers").select("id, company_name, contact_name, is_b2b, n_tahiti, email, phone, address_line1, address_line2, city, island, postal_code, payment_terms, notes, portal_enabled, created_at").eq("id", id).eq("team_id", teamId).single();
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
        validity_date: z.string().optional().describe("Date de validité YYYY-MM-DD"),
        notes: z.string().optional(),
        items: z.array(z.object({
          description: z.string(),
          quantity: z.number().positive(),
          unit_price_ht: z.number().nonnegative(),
          tax_rate_id: z.string().nullable().optional(),
        })).min(1).describe("Lignes du devis")
      },
      async ({ customer_id, currency_id, issue_date, validity_date, notes, items }) => {
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
          validity_date: validity_date ?? null,
          notes: notes ?? null,
          subtotal_ht: Math.round(subtotal_ht * 100) / 100,
          tax_amount: Math.round(tax_amount * 100) / 100,
          total_ttc: Math.round(total_ttc * 100) / 100,
        }).select("id, quote_number").single();

        if (insertErr || !newQuote) return textResult(`Erreur création : ${insertErr?.message}`);

        const { error: itemsErr } = await supabase.from("quote_items").insert(lineItems.map(li => ({ ...li, quote_id: newQuote.id })));
        if (itemsErr) {
          await supabase.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", newQuote.id);
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

  // ── Customers (write) ────────────────────────────────────────────────
  if (can(permissions, "customers", "write", isOwner)) {
    server.tool(
      "create_customer",
      "Crée un nouveau client.",
      {
        company_name: z.string().optional().describe("Raison sociale"),
        contact_name: z.string().optional().describe("Nom du contact"),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address_line1: z.string().optional(),
        city: z.string().optional(),
        island: z.string().optional().describe("Île (ex: Tahiti, Moorea)"),
        n_tahiti: z.string().optional().describe("N° Tahiti fiscal"),
        is_b2b: z.boolean().optional().describe("Client professionnel (B2B)"),
        notes: z.string().optional(),
      },
      async (args) => {
        const { data, error } = await supabase.from("customers").insert({ team_id: teamId, ...args }).select("id, company_name, contact_name").single();
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Client créé. ID : ${data.id} — ${data.company_name ?? data.contact_name}`);
      }
    );

    server.tool(
      "update_customer",
      "Met à jour les informations d'un client.",
      {
        id: z.string().describe("UUID du client"),
        company_name: z.string().optional(),
        contact_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address_line1: z.string().optional(),
        city: z.string().optional(),
        island: z.string().optional(),
        n_tahiti: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ id, ...fields }) => {
        const { error } = await supabase.from("customers").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Client ${id} mis à jour.`);
      }
    );
  }

  // ── Vendors ────────────────────────────────────────────────────────
  if (can(permissions, "clients", "read", isOwner)) {
    server.tool(
      "list_vendors",
      "Liste les fournisseurs.",
      { search: z.string().optional() },
      async ({ search }) => {
        let q = supabase.from("vendors").select("id, name, contact_name, email, phone, n_tahiti").eq("team_id", teamId).order("name");
        if (search) { const s = search.replace(/[,()'";%_]/g, ""); if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%`); }
        const { data, error } = await q.limit(50);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "get_vendor",
      "Détails d'un fournisseur.",
      { id: z.string() },
      async ({ id }) => {
        const { data, error } = await supabase.from("vendors").select("*").eq("id", id).eq("team_id", teamId).single();
        if (error || !data) return textResult("Fournisseur introuvable.");
        return jsonResult(data);
      }
    );
  }

  // ── Expenses ────────────────────────────────────────────────────────
  if (can(permissions, "expenses", "read", isOwner)) {
    server.tool(
      "list_expenses",
      "Liste les dépenses.",
      {
        date_from: z.string().optional().describe("YYYY-MM-DD"),
        date_to: z.string().optional().describe("YYYY-MM-DD"),
        vendor_id: z.string().optional(),
      },
      async ({ date_from, date_to, vendor_id }) => {
        let q = supabase.from("expenses")
          .select("id, description, amount, expense_date, category:category_id(name), vendor:vendor_id(name)")
          .eq("team_id", teamId).is("deleted_at", null).order("expense_date", { ascending: false });
        if (date_from) q = q.gte("expense_date", date_from);
        if (date_to) q = q.lte("expense_date", date_to);
        if (vendor_id) q = q.eq("vendor_id", vendor_id);
        const { data, error } = await q.limit(50);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "expenses", "write", isOwner)) {
    server.tool(
      "create_expense",
      "Crée une dépense. Utilise list_currencies pour obtenir currency_id.",
      {
        description: z.string().min(1),
        amount: z.number().positive(),
        expense_date: z.string().describe("YYYY-MM-DD"),
        currency_id: z.string().describe("UUID de la devise"),
        category_id: z.string().optional().describe("UUID de la catégorie"),
        vendor_id: z.string().optional().describe("UUID du fournisseur"),
        vendor_name: z.string().optional().describe("Nom du fournisseur si pas dans le système"),
        notes: z.string().optional(),
      },
      async (args) => {
        const { data, error } = await supabase.from("expenses").insert({ team_id: teamId, ...args }).select("id").single();
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Dépense créée. ID : ${data.id}`);
      }
    );
  }

  // ── Products (write) ────────────────────────────────────────────────
  if (can(permissions, "catalog", "write", isOwner)) {
    server.tool(
      "create_product",
      "Crée un produit dans le catalogue.",
      {
        name: z.string().min(1),
        description: z.string().optional(),
        sku: z.string().optional(),
        price_ht: z.number().nonnegative(),
        type: z.enum(["product", "service"]).default("product"),
        track_stock: z.boolean().optional().default(false),
        current_stock: z.number().optional(),
        low_stock_alert: z.number().optional(),
        category_id: z.string().optional(),
      },
      async (args) => {
        const { data, error } = await supabase.from("products").insert({ team_id: teamId, is_active: true, ...args }).select("id, name").single();
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Produit "${data.name}" créé. ID : ${data.id}`);
      }
    );

    server.tool(
      "update_product_stock",
      "Met à jour le stock d'un produit.",
      {
        product_id: z.string(),
        current_stock: z.number().min(0),
      },
      async ({ product_id, current_stock }) => {
        const { error } = await supabase.from("products").update({ current_stock }).eq("id", product_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Stock mis à jour → ${current_stock} unités.`);
      }
    );
  }

  // ── Référentiels (devises, TVA, paiements) ────────────────────────
  server.tool(
    "list_currencies",
    "Liste les devises disponibles pour cette équipe. Utiliser currency_id lors de la création de devis/factures.",
    {},
    async () => {
      const { data, error } = await supabase.from("currencies").select("id, code, symbol, name, is_default").eq("team_id", teamId).order("is_default", { ascending: false });
      if (error) return textResult(`Erreur : ${error.message}`);
      return jsonResult(data);
    }
  );

  server.tool(
    "list_tax_rates",
    "Liste les taux de TVA configurés. Utiliser tax_rate_id dans les lignes de devis/factures.",
    {},
    async () => {
      const { data, error } = await supabase.from("tax_rates").select("id, name, rate, is_default").eq("team_id", teamId).order("rate");
      if (error) return textResult(`Erreur : ${error.message}`);
      return jsonResult(data);
    }
  );

  server.tool(
    "list_payment_methods",
    "Liste les méthodes de paiement. Utiliser payment_method_id lors de l'enregistrement d'un paiement.",
    {},
    async () => {
      const { data, error } = await supabase.from("payment_methods").select("id, name, display_name, is_active").eq("team_id", teamId).eq("is_active", true).order("display_name");
      if (error) return textResult(`Erreur : ${error.message}`);
      return jsonResult(data);
    }
  );

  server.tool(
    "list_expense_categories",
    "Liste les catégories de dépenses disponibles.",
    {},
    async () => {
      const { data, error } = await supabase.from("expense_categories").select("id, name").eq("team_id", teamId).order("name");
      if (error) return textResult(`Erreur : ${error.message}`);
      return jsonResult(data);
    }
  );

  // ── Équipe / Paramètres ────────────────────────────────────────────
  if (isOwner || can(permissions, "settings", "read", isOwner)) {
    server.tool(
      "get_team_settings",
      "Retourne les paramètres de l'équipe (nom, email, adresse, N° Tahiti, franchise en base, etc.).",
      {},
      async () => {
        const { data, error } = await supabase.from("teams").select("id, name, email, phone, address_line1, address_line2, city, island, postal_code, n_tahiti, is_franchise_en_base, siret, website, logo_url, late_fee_fixed").eq("id", teamId).single();
        if (error || !data) return textResult("Paramètres introuvables.");
        return jsonResult(data);
      }
    );
  }

  if (isOwner || can(permissions, "settings", "write", isOwner)) {
    server.tool(
      "update_team_settings",
      "Met à jour les paramètres de l'équipe.",
      {
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address_line1: z.string().optional(),
        city: z.string().optional(),
        island: z.string().optional(),
        n_tahiti: z.string().optional().describe("N° Tahiti fiscal"),
        is_franchise_en_base: z.boolean().optional().describe("Si true, TVA masquée sur les PDFs"),
        website: z.string().optional(),
      },
      async (fields) => {
        const { error } = await supabase.from("teams").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Paramètres mis à jour.");
      }
    );
  }

  // ── Rapports ────────────────────────────────────────────────────────
  if (can(permissions, "reports", "read", isOwner)) {
    server.tool(
      "get_pnl_report",
      "Rapport Profits & Pertes pour une période donnée.",
      {
        date_from: z.string().describe("YYYY-MM-DD"),
        date_to: z.string().describe("YYYY-MM-DD"),
      },
      async ({ date_from, date_to }) => {
        const [invRes, expRes, incRes] = await Promise.all([
          supabase.from("invoices").select("total_ttc, status").eq("team_id", teamId).in("status", ["paid", "partial", "sent"]).gte("issue_date", date_from).lte("issue_date", date_to).is("deleted_at", null),
          supabase.from("expenses").select("amount").eq("team_id", teamId).gte("expense_date", date_from).lte("expense_date", date_to).is("deleted_at", null),
          supabase.from("income").select("amount").eq("team_id", teamId).gte("income_date", date_from).lte("income_date", date_to),
        ]);
        const totalInvoiced = (invRes.data ?? []).reduce((s, i) => s + parseFloat(String(i.total_ttc || 0)), 0);
        const totalExpenses = (expRes.data ?? []).reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
        const totalOtherIncome = (incRes.data ?? []).reduce((s, i) => s + parseFloat(String(i.amount || 0)), 0);
        const totalRevenue = totalInvoiced + totalOtherIncome;
        const netIncome = totalRevenue - totalExpenses;
        return jsonResult({ period: { from: date_from, to: date_to }, total_invoiced: Math.round(totalInvoiced), other_income: Math.round(totalOtherIncome), total_revenue: Math.round(totalRevenue), total_expenses: Math.round(totalExpenses), net_income: Math.round(netIncome), profit_margin_pct: totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 100) : 0 });
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
