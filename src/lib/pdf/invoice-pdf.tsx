import React from "react";
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

export type InvoicePdfTeam = {
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  island: string | null;
  postal_code: string | null;
  n_tahiti: string | null;
  rcs_number: string | null;
  is_franchise_en_base: boolean;
  logo_url: string | null;
  invoice_prefix: string;
  late_fee_fixed: number;
  bank_name: string | null;
  bank_rib: string | null;
  bank_iban: string | null;
  bank_bic: string | null;
};

export type InvoicePdfCustomer = {
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  island: string | null;
  postal_code: string | null;
  n_tahiti: string | null;
  is_b2b: boolean;
};

export type InvoicePdfItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  tax_rate_id: string | null;
  tax_rates?: { name: string; rate: number } | null;
};

export type InvoicePdfCurrency = {
  code: string;
  symbol: string;
  symbol_position: string;
};

export type InvoicePdfData = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  service_date: string | null;
  due_date: string;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  paid_amount: number;
  late_fee_fixed: number | null;
  legal_vat_mention: string | null;
  legal_mentions: string | null;
  notes: string | null;
  message: string | null;
  team: InvoicePdfTeam;
  customer: InvoicePdfCustomer;
  items: InvoicePdfItem[];
  currency: InvoicePdfCurrency;
};

// ──────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────

const COLORS = {
  primary: "#1a56db",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  background: "#f9fafb",
  white: "#ffffff",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  // ── Header ──
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 1,
  },
  headerRight: {
    alignItems: "flex-end",
    maxWidth: 180,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 4,
  },
  invoiceStatus: {
    fontSize: 8,
    padding: "3 8",
    borderRadius: 3,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statusSent: {
    backgroundColor: "#dbeafe",
    color: "#1e40af",
  },
  statusPaid: {
    backgroundColor: "#d1fae5",
    color: "#065f46",
  },
  statusOverdue: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusDraft: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },

  // ── Info Grid ──
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 9,
    marginBottom: 1,
  },
  infoHighlight: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 1,
  },

  // ── Items Table ──
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    padding: "6 8",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    color: COLORS.white,
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    padding: "6 8",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.background,
  },
  colDescription: { flex: 3 },
  colQuantity: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTax: { flex: 1, textAlign: "center" },
  colTotal: { flex: 1.5, textAlign: "right" },
  cellText: {
    fontSize: 8,
  },

  // ── Totals ──
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalsBox: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "3 0",
  },
  totalLabel: {
    fontSize: 9,
    color: COLORS.muted,
  },
  totalValue: {
    fontSize: 9,
    textAlign: "right",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "6 0",
    borderTopWidth: 2,
    borderTopColor: COLORS.primary,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLORS.primary,
    textAlign: "right",
  },

  // ── Payment / Legal ──
  legalSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 8,
  },
  legalTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  legalText: {
    fontSize: 7,
    color: COLORS.muted,
    marginBottom: 2,
    lineHeight: 1.5,
  },
  lateFeeText: {
    fontSize: 7,
    color: "#991b1b",
    marginBottom: 2,
    lineHeight: 1.5,
  },
  franchiseText: {
    fontSize: 8,
    color: COLORS.primary,
    fontWeight: "bold",
    marginBottom: 4,
  },
  bankInfo: {
    marginTop: 8,
    padding: "8 10",
    backgroundColor: COLORS.background,
    borderRadius: 4,
  },
  bankTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  bankText: {
    fontSize: 8,
    marginBottom: 1,
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 6,
    color: COLORS.muted,
  },

  // ── Notes / Message ──
  notesBox: {
    marginTop: 8,
    padding: "8 10",
    backgroundColor: COLORS.background,
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    color: COLORS.text,
  },
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: InvoicePdfCurrency): string {
  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency.symbol_position === "prefix"
    ? `${currency.symbol} ${formatted}`
    : `${formatted} ${currency.symbol}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "sent":
      return styles.statusSent;
    case "paid":
      return styles.statusPaid;
    case "overdue":
      return styles.statusOverdue;
    default:
      return styles.statusDraft;
  }
}

function groupTaxes(items: InvoicePdfItem[]): { name: string; rate: number; amount: number }[] {
  const map = new Map<string, { name: string; rate: number; amount: number }>();
  for (const item of items) {
    if (item.tax_rates) {
      const key = item.tax_rates.rate.toString();
      const existing = map.get(key);
      const taxAmount = item.line_total_ht * (item.tax_rates.rate / 100);
      if (existing) {
        existing.amount += taxAmount;
      } else {
        map.set(key, {
          name: item.tax_rates.name,
          rate: item.tax_rates.rate,
          amount: taxAmount,
        });
      }
    }
  }
  return Array.from(map.values());
}

// ──────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────

// Empty items table fallback added in Phase 6.4 to avoid blank table bodies while preserving column structure.
export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  const { team, customer, currency, items } = data;
  const taxGroups = groupTaxes(items);
  const isOverdue = data.status === "overdue";
  const hasLateFee = data.late_fee_fixed && data.late_fee_fixed > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header: Company + Invoice Title ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{team.name ?? "Mon entreprise"}</Text>
            {team.address_line1 && (
              <Text style={styles.companyDetail}>{team.address_line1}</Text>
            )}
            {team.address_line2 && (
              <Text style={styles.companyDetail}>{team.address_line2}</Text>
            )}
            <Text style={styles.companyDetail}>
              {[team.postal_code, team.city, team.island]
                .filter(Boolean)
                .join(" ")}
            </Text>
            {team.email && (
              <Text style={styles.companyDetail}>{team.email}</Text>
            )}
            {team.phone && (
              <Text style={styles.companyDetail}>Tél : {team.phone}</Text>
            )}
            {team.n_tahiti && (
              <Text style={styles.companyDetail}>
                N° TAHITI : {team.n_tahiti}
              </Text>
            )}
            {team.rcs_number && (
              <Text style={styles.companyDetail}>RCS : {team.rcs_number}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text
              style={[styles.invoiceStatus, getStatusStyle(data.status)]}
            >
              {data.status === "draft"
                ? "BROUILLON"
                : data.status === "sent"
                  ? "ENVOYÉE"
                  : data.status === "paid"
                    ? "PAYÉE"
                    : data.status === "overdue"
                      ? "EN RETARD"
                      : data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ── Info Grid: Invoice Meta + Customer ── */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Facture</Text>
            <Text style={styles.infoHighlight}>
              {data.invoice_number}
            </Text>
            <Text style={styles.infoText}>
              Date d&apos;émission : {formatDate(data.issue_date)}
            </Text>
            {data.service_date && (
              <Text style={styles.infoText}>
                Date d&apos;opération : {formatDate(data.service_date)}
              </Text>
            )}
            <Text style={styles.infoText}>
              Échéance : {formatDate(data.due_date)}
            </Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Client</Text>
            <Text style={styles.infoHighlight}>
              {customer.company_name || customer.contact_name}
            </Text>
            {customer.company_name && (
              <Text style={styles.infoText}>{customer.contact_name}</Text>
            )}
            {customer.address_line1 && (
              <Text style={styles.infoText}>{customer.address_line1}</Text>
            )}
            {customer.address_line2 && (
              <Text style={styles.infoText}>{customer.address_line2}</Text>
            )}
            <Text style={styles.infoText}>
              {[customer.postal_code, customer.city, customer.island]
                .filter(Boolean)
                .join(" ")}
            </Text>
            {customer.email && (
              <Text style={styles.infoText}>{customer.email}</Text>
            )}
            {customer.is_b2b && customer.n_tahiti && (
              <Text style={styles.infoText}>
                N° TAHITI : {customer.n_tahiti}
              </Text>
            )}
          </View>
        </View>

        {/* ── Items Table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
              Qté
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>
              Prix HT
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colTax]}>TVA</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>
              Total HT
            </Text>
          </View>

            {items.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={[styles.cellText, styles.colDescription]}>—</Text>
                <Text style={[styles.cellText, styles.colQuantity]}>0</Text>
                <Text style={[styles.cellText, styles.colPrice]}>0</Text>
                <Text style={[styles.cellText, styles.colTax]}>—</Text>
                <Text style={[styles.cellText, styles.colTotal]}>0</Text>
              </View>
            ) : (
              items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}
                  wrap={false}
                >
                  <Text style={[styles.cellText, styles.colDescription]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.cellText, styles.colQuantity]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.cellText, styles.colPrice]}>
                    {formatCurrency(item.unit_price_ht, currency)}
                  </Text>
                  <Text style={[styles.cellText, styles.colTax]}>
                    {item.tax_rates ? `${item.tax_rates.rate}%` : "—"}
                  </Text>
                  <Text style={[styles.cellText, styles.colTotal]}>
                    {formatCurrency(item.line_total_ht, currency)}
                  </Text>
                </View>
              ))
            )}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.subtotal_ht, currency)}
              </Text>
            </View>

            {taxGroups.map((g) => (
              <View key={g.rate} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  TVA {g.name} ({g.rate}%)
                </Text>
                <Text style={styles.totalValue}>
                  {formatCurrency(g.amount, currency)}
                </Text>
              </View>
            ))}

            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total TTC</Text>
              <Text style={styles.grandTotalValue}>
                {formatCurrency(data.total_ttc, currency)}
              </Text>
            </View>

            {data.paid_amount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Déjà payé</Text>
                <Text style={styles.totalValue}>
                  -{formatCurrency(data.paid_amount, currency)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Legal / Payment Section ── */}
        <View style={styles.legalSection}>
          <Text style={styles.legalTitle}>Mentions légales &amp; Paiement</Text>

          {/* Franchise en base */}
          {team.is_franchise_en_base && (
            <Text style={styles.franchiseText}>
              TVA non applicable, franchise en base
            </Text>
          )}

          {/* Legal VAT mention from invoice */}
          {data.legal_vat_mention && (
            <Text style={styles.legalText}>{data.legal_vat_mention}</Text>
          )}

          {/* Late fee notice */}
          {hasLateFee && data.late_fee_fixed && (
            <Text style={styles.lateFeeText}>
              En cas de retard de paiement, une indemnité forfaitaire de{" "}
              {formatCurrency(data.late_fee_fixed, currency)} pour frais de
              recouvrement est applicable (article L. 441-10 du Code de
              commerce). {isOverdue ? "— Facture en retard." : ""}
            </Text>
          )}

          {/* Bank Details */}
          {(team.bank_name || team.bank_rib || team.bank_iban) && (
            <View style={styles.bankInfo}>
              <Text style={styles.bankTitle}>Coordonnées bancaires</Text>
              {team.bank_name && (
                <Text style={styles.bankText}>
                  Banque : {team.bank_name}
                </Text>
              )}
              {team.bank_rib && (
                <Text style={styles.bankText}>RIB : {team.bank_rib}</Text>
              )}
              {team.bank_iban && (
                <Text style={styles.bankText}>
                  IBAN : {team.bank_iban}
                </Text>
              )}
              {team.bank_bic && (
                <Text style={styles.bankText}>BIC : {team.bank_bic}</Text>
              )}
            </View>
          )}

          {/* Custom legal mentions */}
          {data.legal_mentions && (
            <Text style={styles.legalText}>{data.legal_mentions}</Text>
          )}

          {/* Notes / Message */}
          {(data.notes || data.message) && (
            <View style={styles.notesBox}>
              {data.message && (
                <>
                  <Text style={styles.notesTitle}>Message</Text>
                  <Text style={styles.notesText}>{data.message}</Text>
                </>
              )}
              {data.notes && (
                <>
                  <Text style={styles.notesTitle}>Notes</Text>
                  <Text style={styles.notesText}>{data.notes}</Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {team.name} — {team.n_tahiti ? `N° TAHITI ${team.n_tahiti}` : ""}
            {team.n_tahiti && team.city ? " | " : ""}
            {team.city || ""}
            {" — "}
            Document généré le {formatDate(new Date().toISOString())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
