import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency, formatDate, PDF_NEUTRAL } from "./pdf-shared";

// ── Types ──
export type CnPdfTeam = {
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
};

export type CnPdfCustomer = {
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

export type CnPdfItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  tax_rates?: { name: string; rate: number } | null;
};

export type CnPdfCurrency = {
  code: string;
  symbol: string;
  symbol_position: string;
};

export type CreditNotePdfData = {
  id: string;
  credit_note_number: string;
  status: string;
  issue_date: string;
  reason: string | null;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  team: CnPdfTeam;
  customer: CnPdfCustomer;
  items: CnPdfItem[];
  currency: CnPdfCurrency;
  invoice?: { id: string; invoice_number: string } | null;
};

// ── Styles ──
const COLORS = { primary: "#b91c1c", ...PDF_NEUTRAL };

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
  statusIssued: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusApplied: { backgroundColor: "#d1fae5", color: "#065f46" },
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

  reasonBox: { marginTop: 8, padding: "8 10", backgroundColor: COLORS.background, borderRadius: 4 },
  reasonTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  reasonText: { fontSize: 8, color: COLORS.text },

  legalSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 },
  franchiseText: { fontSize: 8, color: COLORS.primary, fontWeight: "bold", marginBottom: 4 },
  legalText: { fontSize: 7, color: COLORS.muted, marginBottom: 2 },

  footer: {
    position: "absolute", bottom: 20, left: 40, right: 40,
    textAlign: "center", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8,
  },
  footerText: { fontSize: 6, color: COLORS.muted },
});

// ── Helpers ──
function getStatusStyle(status: string) {
  switch (status) {
    case "issued": return styles.statusIssued;
    case "applied": return styles.statusApplied;
    default: return styles.statusDraft;
  }
}

// ── Component ──
export function CreditNotePdfDocument({ data }: { data: CreditNotePdfData }) {
  const { team, customer, currency, items } = data;

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
            <Text style={styles.docTitle}>AVOIR</Text>
            <Text style={[styles.docStatus, getStatusStyle(data.status)]}>
              {data.status === "draft" ? "BROUILLON"
                : data.status === "issued" ? "ÉMIS"
                : data.status === "applied" ? "APPLIQUÉ"
                : data.status === "cancelled" ? "ANNULÉ"
                : data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Avoir</Text>
            <Text style={styles.infoHighlight}>{data.credit_note_number}</Text>                <Text style={styles.infoText}>Date d&apos;émission : {formatDate(data.issue_date)}</Text>
            {data.invoice && (
              <Text style={styles.infoText}>Facture référencée : {data.invoice.invoice_number}</Text>
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

        {/* Reason */}
        {data.reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>Motif</Text>
            <Text style={styles.reasonText}>{data.reason}</Text>
          </View>
        )}

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Prix HT</Text>
            {!team.is_franchise_en_base && <Text style={[styles.tableHeaderCell, styles.colTax]}>TVA</Text>}
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
          </View>
          {items.map((item, index) => (
            <View key={item.id} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]} wrap={false}>
              <Text style={[styles.cellText, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.cellText, styles.colQuantity]}>{item.quantity}</Text>
              <Text style={[styles.cellText, styles.colPrice]}>{formatCurrency(item.unit_price_ht, currency)}</Text>
              {!team.is_franchise_en_base && <Text style={[styles.cellText, styles.colTax]}>{item.tax_rates ? `${item.tax_rates.rate}%` : "—"}</Text>}
              <Text style={[styles.cellText, styles.colTotal]}>{formatCurrency(item.line_total_ht, currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            {!team.is_franchise_en_base && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.subtotal_ht, currency)}</Text>
              </View>
            )}
            {!team.is_franchise_en_base && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TVA</Text>
                <Text style={styles.totalValue}>{formatCurrency(data.tax_amount, currency)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>{team.is_franchise_en_base ? "Total" : "Total TTC"}</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(data.total_ttc, currency)}</Text>
            </View>
          </View>
        </View>

        {/* Legal */}
        <View style={styles.legalSection}>
          {team.is_franchise_en_base && (
            <Text style={styles.franchiseText}>TVA non applicable, franchise en base</Text>
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
