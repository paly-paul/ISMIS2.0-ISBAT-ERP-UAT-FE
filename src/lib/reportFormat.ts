// Formatting shared by the finance report pages (Transaction, Outstanding).
// Same output as the Discount Report page's own helpers.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A calendar date (time always 00:00:00): format the string itself, never via
// Date, so no time-zone shift can move it a day. "2026-09-24…" → "24/Sep/2026".
export function fmtReportDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-')
  return y && m && d ? `${d}/${MONTHS[+m - 1]}/${y}` : value
}

export function fmtReportAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtReportCount(n: number): string {
  return n.toLocaleString('en-US')
}

export const REPORT_SOURCE_LABEL: Record<number, string> = { 1: 'Direct payment', 2: 'Advance adjustment' }
export const REPORT_PAYMODE_LABEL: Record<number, string> = { 1: 'Cash', 2: 'Cheque', 3: 'Bank', 4: 'Demand draft', 5: 'Online' }

export function reportErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
