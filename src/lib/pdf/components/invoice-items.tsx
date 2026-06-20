import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfData } from "../invoice-pdf";
import { formatCurrency } from "./_helpers";

const COLORS = { primary: "#1a56db", white: "#ffffff", text: "#1f2937", border: "#e5e7eb", background: "#f9fafb" };

const styles = StyleSheet.create({
  table: { marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: COLORS.primary, padding: "6 8", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableHeaderCell: { color: COLORS.white, fontSize: 7, fontWeight: "bold", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", padding: "6 8", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tableRowAlt: { backgroundColor: COLORS.background },
  colDescription: { flex: 3 },
  colQuantity: { flex: 1, textAlign: "right" as const },
  colPrice: { flex: 1.5, textAlign: "right" as const },
  colTax: { flex: 1, textAlign: "center" as const },
  colTotal: { flex: 1.5, textAlign: "right" as const },
  cellText: { fontSize: 8 },
});

type Props = { data: InvoicePdfData };

export function InvoiceItems({ data }: Props) {
  const { items, currency } = data;
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
        <Text style={[styles.tableHeaderCell, styles.colQuantity]}>Qté</Text>
        <Text style={[styles.tableHeaderCell, styles.colPrice]}>Prix HT</Text>
        <Text style={[styles.tableHeaderCell, styles.colTax]}>TVA</Text>
        <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
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
          <View key={item.id} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]} wrap={false}>
            <Text style={[styles.cellText, styles.colDescription]}>{item.description}</Text>
            <Text style={[styles.cellText, styles.colQuantity]}>{item.quantity}</Text>
            <Text style={[styles.cellText, styles.colPrice]}>{formatCurrency(item.unit_price_ht, currency)}</Text>
            <Text style={[styles.cellText, styles.colTax]}>{item.tax_rates ? `${item.tax_rates.rate}%` : "—"}</Text>
            <Text style={[styles.cellText, styles.colTotal]}>{formatCurrency(item.line_total_ht, currency)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
