import type { InvoicePdfCurrency } from "../invoice-pdf";

export function formatCurrency(amount: number, currency: InvoicePdfCurrency): string {
  const formatted = amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency.symbol_position === "prefix" ? `${currency.symbol} ${formatted}` : `${formatted} ${currency.symbol}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
