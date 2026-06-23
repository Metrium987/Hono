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

  // ── Invoices (write additions) ─────────────────────────────────────
  if (can(permissions, "invoices", "write", isOwner)) {
    server.tool(
      "create_invoice",
      "Crée une facture directement. Utilise list_currencies et list_tax_rates pour les IDs.",
      {
        customer_id: z.string().describe("UUID du client"),
        currency_id: z.string().describe("UUID de la devise"),
        issue_date: z.string().describe("YYYY-MM-DD"),
        due_date: z.string().optional().describe("YYYY-MM-DD"),
        notes: z.string().optional(),
        items: z.array(z.object({
          description: z.string(),
          quantity: z.number().positive(),
          unit_price_ht: z.number().nonnegative(),
          tax_rate_id: z.string().nullable().optional(),
        })).min(1),
      },
      async ({ customer_id, currency_id, issue_date, due_date, notes, items }) => {
        const { data: customer } = await supabase.from("customers").select("id").eq("id", customer_id).eq("team_id", teamId).single();
        if (!customer) return textResult("Erreur : client introuvable.");
        const { data: invNum, error: numErr } = await supabase.rpc("generate_next_invoice_number", { p_team_id: teamId });
        if (numErr) return textResult(`Erreur numérotation : ${numErr.message}`);
        const taxRateIds = [...new Set(items.filter(i => i.tax_rate_id).map(i => i.tax_rate_id!))];
        const taxRateMap = new Map<string, number>();
        if (taxRateIds.length > 0) {
          const { data: rates } = await supabase.from("tax_rates").select("id, rate").eq("team_id", teamId).in("id", taxRateIds);
          rates?.forEach(r => taxRateMap.set(r.id, parseFloat(String(r.rate))));
        }
        const lineItems = items.map((item, i) => {
          const lineHt = item.quantity * item.unit_price_ht;
          const taxRate = item.tax_rate_id ? (taxRateMap.get(item.tax_rate_id) ?? 0) : 0;
          return { description: item.description, quantity: item.quantity, unit_price_ht: item.unit_price_ht, line_total_ht: lineHt, tax_rate_id: item.tax_rate_id ?? null, line_tax_amount: lineHt * (taxRate / 100), sort_order: i };
        });
        const subtotal_ht = lineItems.reduce((s, i) => s + i.line_total_ht, 0);
        const tax_amount = lineItems.reduce((s, i) => s + i.line_tax_amount, 0);
        const total_ttc = subtotal_ht + tax_amount;
        const { data: inv, error: invErr } = await supabase.from("invoices").insert({ team_id: teamId, customer_id, currency_id, invoice_number: invNum, status: "draft", issue_date, due_date: due_date ?? null, notes: notes ?? null, subtotal_ht: Math.round(subtotal_ht * 100) / 100, tax_amount: Math.round(tax_amount * 100) / 100, total_ttc: Math.round(total_ttc * 100) / 100, paid_amount: 0 }).select("id, invoice_number").single();
        if (invErr || !inv) return textResult(`Erreur : ${invErr?.message}`);
        await supabase.from("invoice_items").insert(lineItems.map(li => ({ ...li, invoice_id: inv.id, team_id: teamId })));
        return textResult(`Facture ${inv.invoice_number} créée. ID : ${inv.id}`);
      }
    );

    server.tool(
      "update_invoice_status",
      "Change le statut d'une facture (cancel uniquement sur draft/sent).",
      {
        invoice_id: z.string(),
        status: z.enum(["sent", "cancelled"]),
      },
      async ({ invoice_id, status }) => {
        const { error } = await supabase.from("invoices").update({ status, updated_at: new Date().toISOString() }).eq("id", invoice_id).eq("team_id", teamId).is("deleted_at", null);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Facture ${invoice_id} → ${status}.`);
      }
    );

    server.tool(
      "delete_invoice",
      "Supprime (soft-delete) une facture en statut draft.",
      { invoice_id: z.string() },
      async ({ invoice_id }) => {
        const { data: inv } = await supabase.from("invoices").select("status").eq("id", invoice_id).eq("team_id", teamId).single();
        if (!inv) return textResult("Facture introuvable.");
        if (inv.status !== "draft") return textResult("Seules les factures en brouillon peuvent être supprimées.");
        await supabase.from("invoices").update({ deleted_at: new Date().toISOString() }).eq("id", invoice_id).eq("team_id", teamId);
        return textResult("Facture supprimée (soft-delete).");
      }
    );
  }

  // ── Quotes (write additions) ───────────────────────────────────────
  if (can(permissions, "quotes", "write", isOwner)) {
    server.tool(
      "update_quote_status",
      "Change le statut d'un devis.",
      {
        quote_id: z.string(),
        status: z.enum(["draft", "sent", "accepted", "rejected", "cancelled", "expired"]),
      },
      async ({ quote_id, status }) => {
        const { error } = await supabase.from("quotes").update({ status, updated_at: new Date().toISOString() }).eq("id", quote_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Devis ${quote_id} → ${status}.`);
      }
    );
  }

  // ── Orders (CRUD complet) ──────────────────────────────────────────
  if (can(permissions, "orders", "read", isOwner)) {
    server.tool(
      "get_order",
      "Détails d'une commande avec ses lignes.",
      { order_id: z.string() },
      async ({ order_id }) => {
        const { data, error } = await supabase.from("orders").select("*, customer:customer_id(company_name, contact_name), items:order_items(*, product:product_id(name, sku))").eq("id", order_id).eq("team_id", teamId).single();
        if (error || !data) return textResult("Commande introuvable.");
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "orders", "write", isOwner)) {
    server.tool(
      "create_order",
      "Crée une commande.",
      {
        customer_id: z.string(),
        currency_id: z.string(),
        notes: z.string().optional(),
        items: z.array(z.object({
          product_id: z.string().optional(),
          description: z.string(),
          quantity: z.number().positive(),
          unit_price_ht: z.number().nonnegative(),
        })).min(1),
      },
      async ({ customer_id, currency_id, notes, items }) => {
        const { data: order, error } = await supabase.from("orders").insert({ team_id: teamId, customer_id, currency_id, status: "pending", notes: notes ?? null }).select("id").single();
        if (error || !order) return textResult(`Erreur : ${error?.message}`);
        await supabase.from("order_items").insert(items.map((it, i) => ({ order_id: order.id, team_id: teamId, product_id: it.product_id ?? null, description: it.description, quantity: it.quantity, unit_price_ht: it.unit_price_ht, line_total_ht: it.quantity * it.unit_price_ht, sort_order: i })));
        return textResult(`Commande créée. ID : ${order.id}`);
      }
    );

    server.tool(
      "generate_invoice_from_order",
      "Génère une facture à partir d'une commande existante.",
      { order_id: z.string() },
      async ({ order_id }) => {
        const res = await fetch(`/api/v1/orders/${order_id}/invoice?team_id=${teamId}`, { method: "POST" });
        if (!res.ok) { const j = await res.json().catch(() => ({})); return textResult(`Erreur : ${(j as { error?: string }).error ?? res.statusText}`); }
        const j = await res.json() as { data?: { invoice_number?: string; id?: string } };
        return textResult(`Facture ${j.data?.invoice_number} générée. ID : ${j.data?.id}`);
      }
    );
  }

  // ── Delivery Notes ─────────────────────────────────────────────────
  if (can(permissions, "orders", "read", isOwner)) {
    server.tool(
      "list_delivery_notes",
      "Liste les bons de livraison.",
      { order_id: z.string().optional(), status: z.enum(["draft", "dispatched", "delivered", "cancelled"]).optional() },
      async ({ order_id, status }) => {
        let q = supabase.from("delivery_notes").select("id, note_number, status, created_at, order:order_id(id)").order("created_at", { ascending: false });
        if (order_id) q = q.eq("order_id", order_id);
        if (status) q = q.eq("status", status);
        const { data, error } = await q.limit(30);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "orders", "write", isOwner)) {
    server.tool(
      "create_delivery_note",
      "Crée un bon de livraison pour une commande.",
      {
        order_id: z.string(),
        delivery_address: z.string().optional(),
        recipient_name: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({ product_id: z.string(), quantity_dispatched: z.number().positive() })).min(1),
      },
      async ({ order_id, delivery_address, recipient_name, notes, items }) => {
        const { count } = await supabase.from("delivery_notes").select("id", { count: "exact", head: true });
        const noteNumber = `BL-${String((count ?? 0) + 1).padStart(5, "0")}`;
        const { data: dn, error } = await supabase.from("delivery_notes").insert({ order_id, note_number: noteNumber, delivery_address: delivery_address ?? null, recipient_name: recipient_name ?? null, notes: notes ?? null }).select("id, note_number").single();
        if (error || !dn) return textResult(`Erreur : ${error?.message}`);
        await supabase.from("delivery_note_items").insert(items.map(it => ({ team_id: teamId, delivery_note_id: dn.id, product_id: it.product_id, quantity_dispatched: it.quantity_dispatched, quantity_delivered: 0 })));
        return textResult(`BL ${dn.note_number} créé. ID : ${dn.id}`);
      }
    );
  }

  // ── Income (autres revenus) ────────────────────────────────────────
  if (can(permissions, "expenses", "read", isOwner)) {
    server.tool(
      "list_income",
      "Liste les autres revenus (hors factures).",
      { date_from: z.string().optional(), date_to: z.string().optional() },
      async ({ date_from, date_to }) => {
        let q = supabase.from("income").select("id, description, amount, income_date, category:category_id(name)").eq("team_id", teamId).is("deleted_at", null).order("income_date", { ascending: false });
        if (date_from) q = q.gte("income_date", date_from);
        if (date_to) q = q.lte("income_date", date_to);
        const { data, error } = await q.limit(50);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  if (can(permissions, "expenses", "write", isOwner)) {
    server.tool(
      "create_income",
      "Crée un autre revenu (hors facturation).",
      {
        description: z.string().min(1),
        amount: z.number().positive(),
        income_date: z.string().describe("YYYY-MM-DD"),
        currency_id: z.string(),
        category_id: z.string().optional(),
        notes: z.string().optional(),
      },
      async (args) => {
        const { data, error } = await supabase.from("income").insert({ team_id: teamId, ...args }).select("id").single();
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Revenu créé. ID : ${data.id}`);
      }
    );

    server.tool(
      "delete_expense",
      "Supprime (soft-delete) une dépense.",
      { expense_id: z.string() },
      async ({ expense_id }) => {
        const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", expense_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Dépense supprimée.");
      }
    );
  }

  // ── Vendors (write) ────────────────────────────────────────────────
  if (can(permissions, "clients", "write", isOwner)) {
    server.tool(
      "create_vendor",
      "Crée un fournisseur.",
      {
        name: z.string().min(1),
        contact_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        n_tahiti: z.string().optional(),
        notes: z.string().optional(),
      },
      async (args) => {
        const { data, error } = await supabase.from("vendors").insert({ team_id: teamId, ...args }).select("id, name").single();
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult(`Fournisseur "${data.name}" créé. ID : ${data.id}`);
      }
    );

    server.tool(
      "update_vendor",
      "Met à jour un fournisseur.",
      {
        vendor_id: z.string(),
        name: z.string().optional(),
        contact_name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        n_tahiti: z.string().optional(),
        notes: z.string().optional(),
      },
      async ({ vendor_id, ...fields }) => {
        const { error } = await supabase.from("vendors").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", vendor_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Fournisseur mis à jour.");
      }
    );
  }

  // ── Alerts ─────────────────────────────────────────────────────────
  if (can(permissions, "reports", "read", isOwner)) {
    server.tool(
      "list_alerts",
      "Liste les alertes actives (stock bas, impayés, etc.).",
      { dismissed: z.boolean().optional().default(false) },
      async ({ dismissed }) => {
        let q = supabase.from("system_alerts").select("id, alert_type, severity, title, message, entity_type, entity_id, created_at").eq("team_id", teamId).order("created_at", { ascending: false }).limit(30);
        if (!dismissed) q = q.eq("is_dismissed", false);
        const { data, error } = await q;
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "dismiss_alert",
      "Marque une alerte comme lue/traitée.",
      { alert_id: z.string() },
      async ({ alert_id }) => {
        const { error } = await supabase.from("system_alerts").update({ is_dismissed: true, dismissed_at: new Date().toISOString() }).eq("id", alert_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Alerte masquée.");
      }
    );
  }

  // ── Approvals ──────────────────────────────────────────────────────
  if (isOwner || can(permissions, "settings", "write", isOwner)) {
    server.tool(
      "list_approvals",
      "Liste les demandes d'approbation en attente.",
      { status: z.enum(["pending", "approved", "rejected"]).optional().default("pending") },
      async ({ status }) => {
        const { data, error } = await supabase.from("approvals").select("id, approval_type, status, entity_type, entity_id, requested_at, metadata").eq("team_id", teamId).eq("status", status ?? "pending").order("requested_at", { ascending: false }).limit(30);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );

    server.tool(
      "approve_request",
      "Approuve une demande (dépense, devis).",
      { approval_id: z.string(), comment: z.string().optional() },
      async ({ approval_id, comment }) => {
        const { error } = await supabase.from("approvals").update({ status: "approved", resolved_by: null, resolved_at: new Date().toISOString(), reason: comment ?? null }).eq("id", approval_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Demande approuvée.");
      }
    );

    server.tool(
      "reject_request",
      "Rejette une demande.",
      { approval_id: z.string(), comment: z.string().min(1).describe("Raison du refus") },
      async ({ approval_id, comment }) => {
        const { error } = await supabase.from("approvals").update({ status: "rejected", resolved_at: new Date().toISOString(), reason: comment }).eq("id", approval_id).eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return textResult("Demande rejetée.");
      }
    );
  }

  // ── Credit notes ───────────────────────────────────────────────────
  if (can(permissions, "invoices", "read", isOwner)) {
    server.tool(
      "list_credit_notes",
      "Liste les avoirs.",
      {},
      async () => {
        const { data, error } = await supabase.from("credit_notes").select("id, credit_note_number, status, total_ttc, issue_date, customer:customer_id(company_name, contact_name)").eq("team_id", teamId).order("created_at", { ascending: false }).limit(30);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  // ── Calendar ───────────────────────────────────────────────────────
  server.tool(
    "list_calendar_events",
    "Liste les événements du calendrier.",
    {
      date_from: z.string().optional().describe("YYYY-MM-DD"),
      date_to: z.string().optional().describe("YYYY-MM-DD"),
    },
    async ({ date_from, date_to }) => {
      let q = supabase.from("calendar_events").select("id, title, description, start_at, end_at, event_type, status").eq("team_id", teamId).order("start_at");
      if (date_from) q = q.gte("start_at", date_from);
      if (date_to) q = q.lte("start_at", date_to + "T23:59:59");
      const { data, error } = await q.limit(50);
      if (error) return textResult(`Erreur : ${error.message}`);
      return jsonResult(data);
    }
  );

  server.tool(
    "create_calendar_event",
    "Crée un événement dans le calendrier.",
    {
      title: z.string().min(1),
      start_at: z.string().describe("ISO 8601 datetime"),
      end_at: z.string().optional().describe("ISO 8601 datetime"),
      description: z.string().optional(),
      event_type: z.string().optional().describe("ex: meeting, task, reminder"),
    },
    async (args) => {
      const { data, error } = await supabase.from("calendar_events").insert({ team_id: teamId, status: "scheduled", ...args }).select("id").single();
      if (error) return textResult(`Erreur : ${error.message}`);
      return textResult(`Événement créé. ID : ${data.id}`);
    }
  );

  // ── Team members ───────────────────────────────────────────────────
  if (isOwner || can(permissions, "settings", "read", isOwner)) {
    server.tool(
      "list_team_members",
      "Liste les membres de l'équipe avec leurs rôles.",
      {},
      async () => {
        const { data, error } = await supabase.from("team_members").select("user_id, is_owner, role:team_role_id(name), profile:user_id(full_name, email)").eq("team_id", teamId);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  // ── Commissions ────────────────────────────────────────────────────
  if (can(permissions, "reports", "read", isOwner)) {
    server.tool(
      "list_commissions",
      "Liste les commissions vendeurs.",
      { status: z.enum(["pending", "paid"]).optional() },
      async ({ status }) => {
        let q = supabase.from("invoice_commissions").select("id, amount, status, invoice:invoice_id(invoice_number), staff:staff_id(full_name)").eq("team_id", teamId).order("created_at", { ascending: false });
        if (status) q = q.eq("status", status);
        const { data, error } = await q.limit(30);
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  // ── Recurring invoices ─────────────────────────────────────────────
  if (can(permissions, "invoices", "read", isOwner)) {
    server.tool(
      "list_recurring_invoices",
      "Liste les factures récurrentes configurées.",
      {},
      async () => {
        const { data, error } = await supabase.from("recurring_invoices").select("id, frequency, next_date, status, customer:customer_id(company_name, contact_name), total_ttc").eq("team_id", teamId).order("next_date");
        if (error) return textResult(`Erreur : ${error.message}`);
        return jsonResult(data);
      }
    );
  }

  // ── Inventory ──────────────────────────────────────────────────────
  if (can(permissions, "catalog", "write", isOwner)) {
    server.tool(
      "adjust_inventory",
      "Ajuste manuellement le stock d'un produit avec une raison.",
      {
        product_id: z.string(),
        quantity: z.number().describe("Quantité à ajouter (positif) ou retirer (négatif)"),
        reason: z.string().optional().describe("Motif de l'ajustement"),
      },
      async ({ product_id, quantity, reason }) => {
        const { data: prod } = await supabase.from("products").select("current_stock").eq("id", product_id).eq("team_id", teamId).single();
        if (!prod) return textResult("Produit introuvable.");
        const newStock = Math.max(0, (prod.current_stock ?? 0) + quantity);
        await supabase.from("products").update({ current_stock: newStock }).eq("id", product_id).eq("team_id", teamId);
        await supabase.from("inventory_ledger").insert({ team_id: teamId, product_id, quantity_change: quantity, transaction_type: "manual_adjustment", notes: reason ?? null });
        return textResult(`Stock mis à jour : ${prod.current_stock} → ${newStock} unités.`);
      }
    );
  }

  // ── Global search ──────────────────────────────────────────────────
  server.tool(
    "search",
    "Recherche globale dans clients, factures, devis, produits, fournisseurs.",
    { query: z.string().min(1).describe("Terme recherché") },
    async ({ query }) => {
      const q = query.replace(/[,()'";%_]/g, "").trim();
      if (!q) return textResult("Requête vide.");
      const [cusRes, invRes, qRes, prodRes, venRes] = await Promise.all([
        supabase.from("customers").select("id, company_name, contact_name").eq("team_id", teamId).or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%`).limit(5),
        supabase.from("invoices").select("id, invoice_number, status, total_ttc").eq("team_id", teamId).is("deleted_at", null).ilike("invoice_number", `%${q}%`).limit(5),
        supabase.from("quotes").select("id, quote_number, status, total_ttc").eq("team_id", teamId).ilike("quote_number", `%${q}%`).limit(5),
        supabase.from("products").select("id, name, sku").eq("team_id", teamId).eq("is_active", true).or(`name.ilike.%${q}%,sku.ilike.%${q}%`).limit(5),
        supabase.from("vendors").select("id, name, contact_name").eq("team_id", teamId).or(`name.ilike.%${q}%,contact_name.ilike.%${q}%`).limit(5),
      ]);
      return jsonResult({
        customers: cusRes.data ?? [],
        invoices: invRes.data ?? [],
        quotes: qRes.data ?? [],
        products: prodRes.data ?? [],
        vendors: venRes.data ?? [],
      });
    }
  );
}
