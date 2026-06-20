import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfData } from "../invoice-pdf";
import { formatDate } from "./_helpers";

const COLORS = { text: "#1f2937", muted: "#6b7280" };

const styles = StyleSheet.create({
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  infoBlock: { flex: 1 },
  infoTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 },
  infoText: { fontSize: 9, marginBottom: 1 },
  infoHighlight: { fontSize: 9, fontWeight: "bold", marginBottom: 1 },
});

type Props = { data: InvoicePdfData };

export function InvoiceBuyer({ data }: Props) {
  const { customer } = data;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>Facture</Text>
        <Text style={styles.infoText}>Date d&apos;émission : {formatDate(data.issue_date)}</Text>
        {data.service_date && <Text style={styles.infoText}>Date d&apos;opération : {formatDate(data.service_date)}</Text>}
        <Text style={styles.infoText}>Échéance : {formatDate(data.due_date)}</Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>Client</Text>
        <Text style={styles.infoHighlight}>{customer.company_name || customer.contact_name}</Text>
        {customer.company_name && <Text style={styles.infoText}>{customer.contact_name}</Text>}
        {customer.address_line1 && <Text style={styles.infoText}>{customer.address_line1}</Text>}
        {customer.address_line2 && <Text style={styles.infoText}>{customer.address_line2}</Text>}
        <Text style={styles.infoText}>{[customer.postal_code, customer.city, customer.island].filter(Boolean).join(" ")}</Text>
        {customer.email && <Text style={styles.infoText}>{customer.email}</Text>}
        {customer.is_b2b && customer.n_tahiti && <Text style={styles.infoText}>N° TAHITI : {customer.n_tahiti}</Text>}
      </View>
    </View>
  );
}
