export type PdfCurrency = {
  code: string;
  symbol: string;
  symbol_position: string;
};

export type PdfTeamBase = {
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

export type PdfCustomerBase = {
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

export type PdfLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_ht: number;
  line_total_ht: number;
  tax_rates?: { name: string; rate: number } | null;
};

export function formatCurrency(amount: number, currency: PdfCurrency): string {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency.symbol_position === "prefix"
    ? `${currency.symbol} ${formatted}`
    : `${formatted} ${currency.symbol}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function groupTaxes(items: PdfLineItem[]): { name: string; rate: number; amount: number }[] {
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

export const PDF_NEUTRAL = {
  text: "#1f2937",
  muted: "#6b7280",
  border: "#e5e7eb",
  background: "#f9fafb",
  white: "#ffffff",
} as const;

export const PDF_PAGE_STYLE = {
  padding: 40,
  paddingBottom: 60,
  fontFamily: "Helvetica" as const,
  fontSize: 9,
  lineHeight: 1.4,
};
