/** Shared formatting helpers. Indian numbering, used by engine messages and UI alike. */

export function formatInr(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return sign + "₹" + Math.abs(rounded).toLocaleString("en-IN");
}

export function formatLakh(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 === 0 ? 0 : 1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return formatInr(n);
}

export function formatPoints(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

/** Rounds to 2dp to keep floating-point noise out of stored/compared values. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
