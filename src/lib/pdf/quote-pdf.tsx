import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ── Types ──
export type QuotePdfTeam = {
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
};

export type QuotePdfCustomer = {
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  island: string | null;
  postal_code: string | null;
  is_b2b: boolean;
  n_tahiti: string | null;
};

export type QuotePdfItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  tax_rates?: { name: string; rate: number } | null;
};

export type QuotePdfCurrency = {
  code: string;
  symbol: string;
  symbol_position: string;
};

export type QuotePdfData = {
  id: string;
  quote_number: string;
  status: string;
  issue_date: string;
  validity_date: string | null;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  notes: string | null;
  team: QuotePdfTeam;
  customer: QuotePdfCustomer;
  items: QuotePdfItem[];
  currency: QuotePdfCurrency;
  converted_invoice?: { id: string; invoice_number: string } | null;
};

// ── Styles ──
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
    padding: 40, paddingBottom: 60,
    fontFamily: "Helvetica", fontSize: 9,
    color: COLORS.text, lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    marginBottom: 24, paddingBottom: 16,
    borderBottomWidth: 2, borderBottomColor: COLORS.primary,
  },
  headerLeft: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: COLORS.muted, marginBottom: 1 },
  headerRight: { alignItems: "flex-end", maxWidth: 180 },
  docTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  docStatus: { fontSize: 8, padding: "3 8", borderRadius: 3, textTransform: "uppercase", letterSpacing: 1 },
  statusAccepted: { backgroundColor: "#d1fae5", color: "#065f46" },
  statusConverted: { backgroundColor: "#dbeafe", color: "#1e40af" },
  statusRejected: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusDraft: { backgroundColor: "#f3f4f6", color: "#6b7280" },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  infoBlock: { flex: 1 },
  infoTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  infoText: { fontSize: 9, marginBottom: 1 },
  infoHighlight: { fontSize: 9, fontWeight: "bold", marginBottom: 1 },

  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row", backgroundColor: COLORS.primary,
    padding: "6 8", borderTopLeftRadius: 4, borderTopRightRadius: 4,
  },
  tableHeaderCell: { color: COLORS.white, fontSize: 7, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", padding: "6 8", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowAlt: { backgroundColor: COLORS.background },
  colDescription: { flex: 3 },
  colQuantity: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTax: { flex: 1, textAlign: "center" },
  colTotal: { flex: 1.5, textAlign: "right" },
  cellText: { fontSize: 8 },

  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: "3 0" },
  totalLabel: { fontSize: 9, color: COLORS.muted },
  totalValue: { fontSize: 9, textAlign: "right" },
  grandTotalRow: {
    flexDirection: "row", justifyContent: "space-between", padding: "6 0",
    borderTopWidth: 2, borderTopColor: COLORS.primary, marginTop: 4,
  },
  grandTotalLabel: { fontSize: 11, fontWeight: "bold", color: COLORS.primary },
  grandTotalValue: { fontSize: 11, fontWeight: "bold", color: COLORS.primary, textAlign: "right" },

  legalSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 },
  franchiseText: { fontSize: 8, color: COLORS.primary, fontWeight: "bold", marginBottom: 4 },
  legalText: { fontSize: 7, color: COLORS.muted, marginBottom: 2, lineHeight: 1.5 },

  notesBox: { marginTop: 8, padding: "8 10", backgroundColor: COLORS.background, borderRadius: 4 },
  notesTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  notesText: { fontSize: 8, color: COLORS.text },

  validityText: { fontSize: 7, color: "#991b1b", marginBottom: 2 },

  footer: {
    position: "absolute", bottom: 20, left: 40, right: 40,
    textAlign: "center", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8,
  },
  footerText: { fontSize: 6, color: COLORS.muted },
});

// ── Helpers ──
function formatCurrency(amount: number, currency: QuotePdfCurrency): string {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency.symbol_position === "prefix"
    ? `${currency.symbol} ${formatted}`
    : `${formatted} ${currency.symbol}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusStyle(status: string) {
  switch (status) {
    case "accepted": return styles.statusAccepted;
    case "converted": return styles.statusConverted;
    case "rejected": case "expired": return styles.statusRejected;
    default: return styles.statusDraft;
  }
}

function groupTaxes(items: QuotePdfItem[]): { name: string; rate: number; amount: number }[] {
  const map = new Map<string, { name: string; rate: number; amount: number }>();
  for (const item of items) {
    if (item.tax_rates) {
      const key = item.tax_rates.rate.toString();
      const existing = map.get(key);
      const taxAmount = item.line_total_ht * (item.tax_rates.rate / 100);
      if (existing) existing.amount += taxAmount;
      else map.set(key, { name: item.tax_rates.name, rate: item.tax_rates.rate, amount: taxAmount });
    }
  }
  return Array.from(map.values());
}

// ── Component ──
export function QuotePdfDocument({ data }: { data: QuotePdfData }) {
  const { team, customer, currency, items } = data;
  const taxGroups = groupTaxes(items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{team.name}</Text>
            {team.address_line1 && <Text style={styles.companyDetail}>{team.address_line1}</Text>}
            {team.address_line2 && <Text style={styles.companyDetail}>{team.address_line2}</Text>}
            <Text style={styles.companyDetail}>
              {[team.postal_code, team.city, team.island].filter(Boolean).join(" ")}
            </Text>
            {team.email && <Text style={styles.companyDetail}>{team.email}</Text>}
            {team.phone && <Text style={styles.companyDetail}>Tél : {team.phone}</Text>}
            {team.n_tahiti && <Text style={styles.companyDetail}>N° TAHITI : {team.n_tahiti}</Text>}
            {team.rcs_number && <Text style={styles.companyDetail}>RCS : {team.rcs_number}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>DEVIS</Text>
            <Text style={[styles.docStatus, getStatusStyle(data.status)]}>
              {data.status === "draft" ? "BROUILLON"
                : data.status === "accepted" ? "ACCEPTÉ"
                : data.status === "converted" ? "CONVERTI EN FACTURE"
                : data.status === "rejected" ? "REFUSÉ"
                : data.status === "expired" ? "EXPIRÉ"
                : data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Devis</Text>
            <Text style={styles.infoHighlight}>{data.quote_number}</Text>
            <Text style={styles.infoText}>Date d'émission : {formatDate(data.issue_date)}</Text>
            {data.validity_date && (
              <Text style={styles.validityText}>Valable jusqu'au : {formatDate(data.validity_date)}</Text>
            )}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Client</Text>
            <Text style={styles.infoHighlight}>{customer.company_name || customer.contact_name}</Text>
            {customer.company_name && <Text style={styles.infoText}>{customer.contact_name}</Text>}
            {[customer.address_line1, customer.address_line2].filter(Boolean).map((l, i) => (
              <Text key={i} style={styles.infoText}>{l}</Text>
            ))}
            <Text style={styles.infoText}>
              {[customer.postal_code, customer.city, customer.island].filter(Boolean).join(" ")}
            </Text>
            {customer.email && <Text style={styles.infoText}>{customer.email}</Text>}
            {customer.is_b2b && customer.n_tahiti && (
              <Text style={styles.infoText}>N° TAHITI : {customer.n_tahiti}</Text>
            )}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Prix HT</Text>
            <Text style={[styles.tableHeaderCell, styles.colTax]}>TVA</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
          </View>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]} wrap={false}>
              <Text style={[styles.cellText, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.cellText, styles.colQuantity]}>{item.quantity}</Text>
              <Text style={[styles.cellText, styles.colPrice]}>{formatCurrency(item.unit_price_ht, currency)}</Text>
              <Text style={[styles.cellText, styles.colTax]}>{item.tax_rates ? `${item.tax_rates.rate}%` : "—"}</Text>
              <Text style={[styles.cellText, styles.colTotal]}>{formatCurrency(item.line_total_ht, currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>{formatCurrency(data.subtotal_ht, currency)}</Text>
            </View>
            {taxGroups.map((g) => (
              <View key={g.rate} style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA {g.name} ({g.rate}%)</Text>
                <Text style={styles.totalValue}>{formatCurrency(g.amount, currency)}</Text>
              </View>
            ))}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total TTC</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(data.total_ttc, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          {team.is_franchise_en_base && (
            <Text style={styles.franchiseText}>TVA non applicable, franchise en base</Text>
          )}
          {data.converted_invoice && (
            <Text style={styles.legalText}>
              Ce devis a été converti en facture : {data.converted_invoice.invoice_number}
            </Text>
          )}
          {data.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>Notes</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {team.name}{team.n_tahiti ? ` — N° TAHITI ${team.n_tahiti}` : ""}{team.city ? ` | ${team.city}` : ""}
            {" — "}Document généré le {formatDate(new Date().toISOString())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
