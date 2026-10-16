export function formatDate(value: Date | string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day}/${month}/${year}`
}

export function formatDateTime(value: Date | string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${formatDate(date)} ${date.toLocaleTimeString('en-GB')}`
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Today as yyyy-mm-dd in local time (not toISOString(), which is UTC and
// still "yesterday" in Uganda until 03:00).
export function todayYmd(): string {
  return toYmd(new Date())
}

// Same calendar day `months` months ago, as yyyy-mm-dd. Clamps to the last
// day when the target month is shorter (31 May → 28/29 Feb) instead of
// rolling over into the next month — matches the backend's AddMonths.
export function monthsAgoYmd(months: number): string {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() - months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(now.getDate(), lastDay))
  return toYmd(target)
}

// Same calendar day `years` years ago (29 Feb clamps to 28 Feb).
export function yearsAgoYmd(years: number): string {
  return monthsAgoYmd(years * 12)
}

// yyyy-mm-dd → "14 October 2016", for messages that name a cutoff date.
export function formatLongYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Window shared by Application Payment's payDate and Enquiry's enquiryDate:
// within the last 3 months, never in the future.
export const RECENT_DATE_MONTHS = 3
export function isWithinRecentWindow(ymd: string): boolean {
  return ymd >= monthsAgoYmd(RECENT_DATE_MONTHS) && ymd <= todayYmd()
}

// "5m ago" / "3h ago" / "Yesterday" / falls back to formatDate() once it's
// far enough in the past that a relative label stops being useful.
export function timeAgo(value: Date | string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}
