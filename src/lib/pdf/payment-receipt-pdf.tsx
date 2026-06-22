import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

export type PaymentReceiptData = {
  payment: {
    id: string;
    amount: number;
    payment_date: string;
    reference: string | null;
    notes: string | null;
    created_at: string;
  };
  invoice: {
    invoice_number: string;
    total_ttc: number;
    paid_amount: number;
    issue_date: string;
    due_date: string;
  };
  customer: {
    company_name: string | null;
    contact_name: string;
    email: string | null;
    n_tahiti: string | null;
    is_b2b: boolean;
  };
  team: {
    name: string;
    email: string | null;
    n_tahiti: string | null;
    rcs_number: string | null;
    address_line1: string | null;
    city: string | null;
  };
  payment_method: { name: string; display_name: string | null } | null;
  currency_symbol: string;
};

const COLORS = {
  primary: "#16a34a",
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  background: "#f9fafb",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: COLORS.text },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  headerLeft: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: COLORS.muted, marginBottom: 1 },
  headerRight: { alignItems: "flex-end" },
  docTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  infoRow: { flexDirection: "row", marginBottom: 20 },
  infoBlock: { flex: 1 },
  infoTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  infoText: { fontSize: 9, marginBottom: 1 },
  infoHighlight: { fontSize: 9, fontWeight: "bold", marginBottom: 1 },

  amountBox: { backgroundColor: COLORS.background, borderRadius: 8, padding: 16, marginBottom: 20, alignItems: "center" },
  amountLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  amountValue: { fontSize: 24, fontWeight: "bold", color: COLORS.primary },

  detailRow: { flexDirection: "row", justifyContent: "space-between", padding: "4 0", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailLabel: { fontSize: 9, color: COLORS.muted },
  detailValue: { fontSize: 9, textAlign: "right" },

  footer: { position: "absolute", bottom: 20, left: 40, right: 40, textAlign: "center", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footerText: { fontSize: 6, color: COLORS.muted },
});

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PaymentReceiptPdfDocument({ data }: { data: PaymentReceiptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{data.team.name}</Text>
            {data.team.address_line1 && <Text style={styles.companyDetail}>{data.team.address_line1}</Text>}
            {[data.team.city, data.team.email].filter(Boolean).join(" | ") && (
              <Text style={styles.companyDetail}>{[data.team.city, data.team.email].filter(Boolean).join(" | ")}</Text>
            )}
            {data.team.n_tahiti && <Text style={styles.companyDetail}>N° TAHITI : {data.team.n_tahiti}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitle}>REÇU DE PAIEMENT</Text>
          </View>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Montant reçu</Text>
          <Text style={styles.amountValue}>
            {data.payment.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency_symbol}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Paiement</Text>
            <Text style={styles.infoHighlight}>{data.payment_method?.display_name ?? data.payment_method?.name ?? ""}</Text>
            <Text style={styles.infoText}>Date : {formatDate(data.payment.payment_date)}</Text>
            {data.payment.reference && <Text style={styles.infoText}>Réf : {data.payment.reference}</Text>}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Facture</Text>
            <Text style={styles.infoHighlight}>{data.invoice.invoice_number}</Text>
            <Text style={styles.infoText}>Émise le {formatDate(data.invoice.issue_date)}</Text>
            <Text style={styles.infoText}>Échéance le {formatDate(data.invoice.due_date)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Client</Text>
            <Text style={styles.infoHighlight}>{data.customer.company_name || data.customer.contact_name}</Text>
            {data.customer.email && <Text style={styles.infoText}>{data.customer.email}</Text>}
            {data.customer.is_b2b && data.customer.n_tahiti && <Text style={styles.infoText}>N° TAHITI : {data.customer.n_tahiti}</Text>}
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 }}>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Total facture</Text><Text style={styles.detailValue}>{data.invoice.total_ttc.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency_symbol}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Montant payé</Text><Text style={{ ...styles.detailValue, color: COLORS.primary, fontWeight: "bold" }}>{data.payment.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency_symbol}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Total payé à ce jour</Text><Text style={styles.detailValue}>{data.invoice.paid_amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {data.currency_symbol}</Text></View>
        </View>

        {data.payment.notes && (
          <View style={{ marginTop: 12, padding: "8 10", backgroundColor: COLORS.background, borderRadius: 4 }}>
            <Text style={{ fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Notes</Text>
            <Text style={{ fontSize: 8 }}>{data.payment.notes}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {data.team.name} — Reçu généré le {formatDate(new Date().toISOString())}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
