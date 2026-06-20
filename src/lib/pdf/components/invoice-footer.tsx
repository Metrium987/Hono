import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { InvoicePdfData } from "../invoice-pdf";
import { formatCurrency, formatDate } from "./_helpers";

const COLORS = { primary: "#1a56db", text: "#1f2937", muted: "#6b7280", border: "#e5e7eb", background: "#f9fafb" };

const styles = StyleSheet.create({
  legalSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, marginTop: 8 },
  legalTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 },
  legalText: { fontSize: 7, color: COLORS.muted, marginBottom: 2, lineHeight: 1.5 },
  lateFeeText: { fontSize: 7, color: "#991b1b", marginBottom: 2, lineHeight: 1.5 },
  franchiseText: { fontSize: 8, color: COLORS.primary, fontWeight: "bold", marginBottom: 4 },
  bankInfo: { marginTop: 8, padding: "8 10", backgroundColor: COLORS.background, borderRadius: 4 },
  bankTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 4 },
  bankText: { fontSize: 8, marginBottom: 1 },
  notesBox: { marginTop: 8, padding: "8 10", backgroundColor: COLORS.background, borderRadius: 4 },
  notesTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 2 },
  notesText: { fontSize: 8, color: COLORS.text },
  footer: { position: "absolute" as const, bottom: 20, left: 40, right: 40, textAlign: "center" as const, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footerText: { fontSize: 6, color: COLORS.muted },
});

type Props = { data: InvoicePdfData };

export function InvoiceFooter({ data }: Props) {
  const { team, currency } = data;
  const isOverdue = data.status === "overdue";
  const hasLateFee = data.late_fee_fixed && data.late_fee_fixed > 0;

  return (
    <>
      <View style={styles.legalSection}>
        <Text style={styles.legalTitle}>Mentions légales &amp; Paiement</Text>

        {team.is_franchise_en_base && (
          <Text style={styles.franchiseText}>TVA non applicable, franchise en base</Text>
        )}

        {data.legal_vat_mention && <Text style={styles.legalText}>{data.legal_vat_mention}</Text>}

        {hasLateFee && data.late_fee_fixed && (
          <Text style={styles.lateFeeText}>
            En cas de retard de paiement, une indemnité forfaitaire de {formatCurrency(data.late_fee_fixed, currency)}
            {" "}pour frais de recouvrement est applicable (article L. 441-10 du Code de commerce).
            {isOverdue ? " — Facture en retard." : ""}
          </Text>
        )}

        {(team.bank_name || team.bank_rib || team.bank_iban) && (
          <View style={styles.bankInfo}>
            <Text style={styles.bankTitle}>Coordonnées bancaires</Text>
            {team.bank_name && <Text style={styles.bankText}>Banque : {team.bank_name}</Text>}
            {team.bank_rib && <Text style={styles.bankText}>RIB : {team.bank_rib}</Text>}
            {team.bank_iban && <Text style={styles.bankText}>IBAN : {team.bank_iban}</Text>}
            {team.bank_bic && <Text style={styles.bankText}>BIC : {team.bank_bic}</Text>}
          </View>
        )}

        {data.legal_mentions && <Text style={styles.legalText}>{data.legal_mentions}</Text>}

        {(data.notes || data.message) && (
          <View style={styles.notesBox}>
            {data.message && <>
              <Text style={styles.notesTitle}>Message</Text>
              <Text style={styles.notesText}>{data.message}</Text>
            </>}
            {data.notes && <>
              <Text style={styles.notesTitle}>Notes</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </>}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {team.name} — {team.n_tahiti ? `N° TAHITI ${team.n_tahiti}` : ""}
          {team.n_tahiti && team.city ? " | " : ""}{team.city || ""}
          {" — "}Document généré le {formatDate(new Date().toISOString())}
        </Text>
      </View>
    </>
  );
}
