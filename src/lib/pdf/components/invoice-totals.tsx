import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfData, InvoicePdfItem } from "../invoice-pdf";
import { formatCurrency } from "./_helpers";

const COLORS = { primary: "#1a56db", text: "#1f2937", muted: "#6b7280", border: "#e5e7eb" };

const styles = StyleSheet.create({
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: "3 0" },
  totalLabel: { fontSize: 9, color: COLORS.muted },
  totalValue: { fontSize: 9, textAlign: "right" as const },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", padding: "6 0", borderTopWidth: 2, borderTopColor: COLORS.primary, marginTop: 4 },
  grandTotalLabel: { fontSize: 11, fontWeight: "bold", color: COLORS.primary },
  grandTotalValue: { fontSize: 11, fontWeight: "bold", color: COLORS.primary, textAlign: "right" as const },
});

function groupTaxes(items: InvoicePdfItem[]): { name: string; rate: number; amount: number }[] {
  const map = new Map<string, { name: string; rate: number; amount: number }>();
  for (const item of items) {
    if (item.tax_rates) {
      const key = item.tax_rates.rate.toString();
      const existing = map.get(key);
      const taxAmount = item.line_total_ht * (item.tax_rates.rate / 100);
      if (existing) { existing.amount += taxAmount; }
      else { map.set(key, { name: item.tax_rates.name, rate: item.tax_rates.rate, amount: taxAmount }); }
    }
  }
  return Array.from(map.values());
}

type Props = { data: InvoicePdfData };

export function InvoiceTotals({ data }: Props) {
  const { currency } = data;
  const taxGroups = groupTaxes(data.items);

  return (
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

        {data.paid_amount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Déjà payé</Text>
            <Text style={styles.totalValue}>-{formatCurrency(data.paid_amount, currency)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
