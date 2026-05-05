/**
 * Currency formatting helpers for Ghana Cedi values.
 */
export function formatCurrency(amount: number): string {
  return `₵${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
