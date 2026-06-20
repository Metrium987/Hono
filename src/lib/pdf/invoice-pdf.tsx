import React from "react";
import { Document, Page, View, StyleSheet, Font } from "@react-pdf/renderer";

// ──────────────────────────────────────────────────────────
// Font Registration (Inter — extended character support)
// ──────────────────────────────────────────────────────────

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2", fontWeight: 500 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYAZ9hiJ-Ek-_EeA.woff2", fontWeight: 700 },
  ],
});
import { InvoiceHeader } from "./components/invoice-header";
import { InvoiceBuyer } from "./components/invoice-buyer";
import { InvoiceItems } from "./components/invoice-items";
import { InvoiceTotals } from "./components/invoice-totals";
import { InvoiceFooter } from "./components/invoice-footer";
import { InvoiceStamp } from "./components/invoice-stamp";

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
  dicp_id: string | null;
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
// Page Styles
// ──────────────────────────────────────────────────────────

const COLORS = { text: "#1f2937" };

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: "Inter",
    fontSize: 9,
    color: COLORS.text,
    lineHeight: 1.4,
  },
});

// ──────────────────────────────────────────────────────────
// Orchestrator Component
// ──────────────────────────────────────────────────────────

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <InvoiceStamp status={data.status} />
        <InvoiceHeader data={data} />
        <InvoiceBuyer data={data} />
        <InvoiceItems data={data} />
        <InvoiceTotals data={data} />
        <InvoiceFooter data={data} />
      </Page>
    </Document>
  );
}
