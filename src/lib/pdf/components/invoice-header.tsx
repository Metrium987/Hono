import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfData } from "../invoice-pdf";
import { formatDate } from "../pdf-shared";

const COLORS = { primary: "#1a56db", text: "#1f2937", muted: "#6b7280" };

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  headerLeft: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: COLORS.muted, marginBottom: 1 },
  headerRight: { alignItems: "flex-end", maxWidth: 180 },
  invoiceTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  invoiceStatus: { fontSize: 8, padding: "3 8", borderRadius: 3, textTransform: "uppercase" as const, letterSpacing: 1 },
  statusSent: { backgroundColor: "#dbeafe", color: "#1e40af" },
  statusPaid: { backgroundColor: "#d1fae5", color: "#065f46" },
  statusOverdue: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusDraft: { backgroundColor: "#f3f4f6", color: "#6b7280" },
});

function getStatusStyle(status: string) {
  switch (status) {
    case "sent": return styles.statusSent;
    case "paid": return styles.statusPaid;
    case "overdue": return styles.statusOverdue;
    default: return styles.statusDraft;
  }
}

type Props = { data: InvoicePdfData };

export function InvoiceHeader({ data }: Props) {
  const { team } = data;
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerLeft}>
        <Text style={styles.companyName}>{team.name ?? "Mon entreprise"}</Text>
        {team.address_line1 && <Text style={styles.companyDetail}>{team.address_line1}</Text>}
        {team.address_line2 && <Text style={styles.companyDetail}>{team.address_line2}</Text>}
        <Text style={styles.companyDetail}>{[team.postal_code, team.city, team.island].filter(Boolean).join(" ")}</Text>
        {team.email && <Text style={styles.companyDetail}>{team.email}</Text>}
        {team.phone && <Text style={styles.companyDetail}>Tél : {team.phone}</Text>}
        {team.n_tahiti && <Text style={styles.companyDetail}>N° TAHITI : {team.n_tahiti}</Text>}
        {team.rcs_number && <Text style={styles.companyDetail}>RCS : {team.rcs_number}</Text>}
        {team.dicp_id && <Text style={styles.companyDetail}>N° DICP : {team.dicp_id}</Text>}
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.invoiceTitle}>FACTURE</Text>
        <Text style={[styles.invoiceStatus, getStatusStyle(data.status)]}>
          {data.status === "draft" ? "BROUILLON" : data.status === "sent" ? "ENVOYÉE" : data.status === "paid" ? "PAYÉE" : data.status === "overdue" ? "EN RETARD" : data.status.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: "bold", color: COLORS.text, marginTop: 4 }}>{data.invoice_number}</Text>
      </View>
    </View>
  );
}
