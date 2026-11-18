// Money in minor units. USD and THB are never summed together.

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);
}

/** Share of an amount in basis points, rounded down (the remainder stays with the company). */
export function shareOf(baseMinor: number, percentBp: number): number {
  const v = (Math.abs(baseMinor) * percentBp) / 10000;
  return Math.sign(baseMinor) * Math.floor(v);
}

/** Add amounts per currency. */
export function sumByCurrency(rows: { currency: string; amountMinor: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + r.amountMinor;
  return out;
}
