/**
 * Centralized currency formatting utility.
 * XPF (CFP Franc) is zero-decimal — no fractional digits.
 * For all other currencies, uses 2 decimal places.
 */

export function formatCurrency(
  amount: number,
  currencyCode = "XPF",
  locale = "fr-FR"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: currencyCode === "XPF" ? 0 : 2,
    maximumFractionDigits: currencyCode === "XPF" ? 0 : 2,
  }).format(amount);
}

/**
 * Simple number formatting with currency symbol suffix (fallback when Intl.NumberFormat isn't ideal).
 * Example: "1 500 F CFP"
 */
export function formatCurrencySimple(
  amount: number,
  symbol = "F",
  locale = "fr-FR"
): string {
  return `${amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}
