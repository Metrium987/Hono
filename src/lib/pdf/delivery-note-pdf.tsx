import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { formatDate, PDF_NEUTRAL } from "./pdf-shared";

// ── Types ──

export type DeliveryNotePdfTeam = {
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

export type DeliveryNotePdfCustomer = {
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  island: string | null;
  n_tahiti: string | null;
  is_b2b: boolean;
} | null;

export type DeliveryNotePdfItem = {
  id: string;
  quantity: number;
  unit_price: number | null;
  product: { name: string; sku: string | null } | null;
};

export type DeliveryNotePdfData = {
  id: string;
  note_number: string;
  status: string;
  created_at: string;
  dispatched_at: string | null;
  delivered_at: string | null;
  delivery_address: string | null;
  recipient_name: string | null;
  recipient_id_doc: string | null;
  notes: string | null;
  order: { order_number: string } | null;
  items: DeliveryNotePdfItem[];
  team: DeliveryNotePdfTeam;
  customer: DeliveryNotePdfCustomer;
};

// ── Styles ──

const COLORS = { primary: "#0e7c5b", ...PDF_NEUTRAL };

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
  companyName: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  companyDetail: { fontSize: 8, color: COLORS.muted, marginBottom: 1 },
  docTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  docMeta: { fontSize: 8, color: COLORS.muted, marginBottom: 2 },

  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20, gap: 12 },
  infoBlock: { flex: 1 },
  infoTitle: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  infoText: { fontSize: 9, marginBottom: 1 },
  infoHighlight: { fontSize: 9, fontWeight: "bold", marginBottom: 1 },

  table: { marginBottom: 20 },
  tableHeader: {
    flexDirection: "row", backgroundColor: COLORS.background,
    padding: "6 8", borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tableHeaderCell: { fontSize: 8, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row", padding: "7 8",
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  colProduct: { flex: 3 },
  colSku: { flex: 1.5, color: COLORS.muted },
  colQty: { width: 50, textAlign: "right" },
  colUnit: { width: 70, textAlign: "right" },

  notesBlock: {
    backgroundColor: COLORS.background, padding: 10, borderRadius: 3,
    marginBottom: 20,
  },
  notesLabel: { fontSize: 7, fontWeight: "bold", color: COLORS.muted, textTransform: "uppercase", marginBottom: 3 },
  notesText: { fontSize: 8, color: COLORS.text },

  signatureRow: {
    flexDirection: "row", justifyContent: "space-between", marginTop: 30,
  },
  signatureBlock: {
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 6, width: "45%",
  },
  signatureLabel: { fontSize: 8, color: COLORS.muted },

  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 6, flexDirection: "row", justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: COLORS.muted },
});

// ── Status labels ──

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  dispatched: "Expédié",
  delivered: "Livré",
  cancelled: "Annulé",
};

// ── Helpers ──

function formatOptionalDate(d: string | null | undefined): string {
  if (!d) return "—";
  return formatDate(d);
}

function addressLine(team: DeliveryNotePdfTeam): string {
  const parts = [team.address_line1, team.city, team.island].filter(Boolean);
  return parts.join(", ") || "—";
}

function customerAddressLine(c: NonNullable<DeliveryNotePdfCustomer>): string {
  const parts = [c.address_line1, c.city, c.island].filter(Boolean);
  return parts.join(", ") || "—";
}

// ── Component ──

export function DeliveryNotePdfDocument({ data }: { data: DeliveryNotePdfData }) {
  const { team, customer, items } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{team.name}</Text>
            <Text style={styles.companyDetail}>{addressLine(team)}</Text>
            {team.email && <Text style={styles.companyDetail}>{team.email}</Text>}
            {team.phone && <Text style={styles.companyDetail}>{team.phone}</Text>}
            {team.n_tahiti && <Text style={styles.companyDetail}>N° TAHITI : {team.n_tahiti}</Text>}
            {team.rcs_number && <Text style={styles.companyDetail}>RCS : {team.rcs_number}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.docTitle}>BON DE LIVRAISON</Text>
            <Text style={styles.docMeta}>{data.note_number}</Text>
            <Text style={styles.docMeta}>{STATUS_LABELS[data.status] ?? data.status}</Text>
          </View>
        </View>

        {/* ── Info row ── */}
        <View style={styles.infoRow}>

          {/* Dates */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Dates</Text>
            <Text style={styles.infoText}>Créé le : {formatOptionalDate(data.created_at)}</Text>
            {data.dispatched_at && (
              <Text style={styles.infoText}>Expédié le : {formatOptionalDate(data.dispatched_at)}</Text>
            )}
            {data.delivered_at && (
              <Text style={styles.infoText}>Livré le : {formatOptionalDate(data.delivered_at)}</Text>
            )}
            {data.order && (
              <Text style={[styles.infoText, { marginTop: 6 }]}>
                Réf. commande : {data.order.order_number}
              </Text>
            )}
          </View>

          {/* Livraison à */}
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Livraison à</Text>
            {customer ? (
              <>
                <Text style={styles.infoHighlight}>
                  {customer.company_name || customer.contact_name}
                </Text>
                {customer.company_name && (
                  <Text style={styles.infoText}>{customer.contact_name}</Text>
                )}
                <Text style={styles.infoText}>{customerAddressLine(customer)}</Text>
                {customer.email && <Text style={styles.infoText}>{customer.email}</Text>}
                {customer.is_b2b && customer.n_tahiti && (
                  <Text style={styles.infoText}>N° TAHITI : {customer.n_tahiti}</Text>
                )}
              </>
            ) : (
              <>
                {data.recipient_name && (
                  <Text style={styles.infoHighlight}>{data.recipient_name}</Text>
                )}
                {data.delivery_address && (
                  <Text style={styles.infoText}>{data.delivery_address}</Text>
                )}
                {data.recipient_id_doc && (
                  <Text style={styles.infoText}>{"Pièce d'identité : "}{data.recipient_id_doc}</Text>
                )}
              </>
            )}
          </View>

          {/* Adresse de livraison si distincte */}
          {data.delivery_address && customer && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoTitle}>Adresse de livraison</Text>
              <Text style={styles.infoText}>{data.delivery_address}</Text>
              {data.recipient_name && (
                <Text style={styles.infoText}>{"À l'attention de : "}{data.recipient_name}</Text>
              )}
            </View>
          )}
        </View>

        {/* ── Franchise en base notice ── */}
        {team.is_franchise_en_base && (
          <View style={{ marginBottom: 12, padding: 8, backgroundColor: COLORS.background }}>
            <Text style={{ fontSize: 8, color: COLORS.muted, fontStyle: "italic" }}>
              TVA non applicable, franchise en base
            </Text>
          </View>
        )}

        {/* ── Items table ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colProduct]}>Produit</Text>
            <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qté</Text>
            {!team.is_franchise_en_base && (
              <Text style={[styles.tableHeaderCell, styles.colUnit]}>Prix unitaire</Text>
            )}
          </View>
          {items.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ color: COLORS.muted, fontSize: 8 }}>Aucun article</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.colProduct, { fontSize: 9 }]}>
                  {item.product?.name ?? "—"}
                </Text>
                <Text style={[styles.colSku, { fontSize: 8 }]}>
                  {item.product?.sku ?? "—"}
                </Text>
                <Text style={[styles.colQty, { fontSize: 9 }]}>
                  {item.quantity}
                </Text>
                {!team.is_franchise_en_base && (
                  <Text style={[styles.colUnit, { fontSize: 9 }]}>
                    {item.unit_price !== null
                      ? `${Number(item.unit_price).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} F`
                      : "—"}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Zone de signature ── */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Signature du livreur</Text>
            <View style={{ height: 40 }} />
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLabel}>Signature du destinataire</Text>
            <View style={{ height: 40 }} />
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{team.name} — N° TAHITI : {team.n_tahiti ?? "—"}</Text>
          <Text style={styles.footerText}>{data.note_number}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`}
          />
        </View>

      </Page>
    </Document>
  );
}
