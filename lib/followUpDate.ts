/** Date-only follow-up helpers. Never display or depend on a clock time. */

const pad2 = (n: number) => String(n).padStart(2, '0')

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/**
 * Calendar YYYY-MM-DD for a stored follow-up value.
 * UTC midnight ISO strings use the date prefix so IST does not show the previous/next day.
 */
export function followUpDateToYmd(value?: string | Date | null): string | null {
  if (value == null || value === '') return null

  const s = value instanceof Date ? value.toISOString() : String(value).trim()
  if (!s) return null

  const prefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (prefix) {
    return `${prefix[1]}-${prefix[2]}-${prefix[3]}`
  }

  const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (dmy) {
    return ymdFromParts(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
  }

  const d = value instanceof Date ? value : new Date(s)
  if (Number.isNaN(d.getTime())) return null

  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return ymdFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }

  return ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Display as dd/mm/yyyy with no time. */
export function formatFollowUpDate(value?: string | Date | null): string {
  const ymd = followUpDateToYmd(value)
  if (!ymd) return '-'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** Value for `<input type="date">`. */
export function toFollowUpDateInputValue(value?: string | Date | null): string {
  return followUpDateToYmd(value) || ''
}

/** Payload: YYYY-MM-DD only (no time, no timezone offset). */
export function toFollowUpDatePayload(dateStr: string): string | undefined {
  const s = String(dateStr || '').trim()
  if (!s) return undefined
  const ymd = followUpDateToYmd(s)
  return ymd || undefined
}

export function isFollowUpDateOverdue(value?: string | Date | null, todayYmd?: string): boolean {
  const ymd = followUpDateToYmd(value)
  if (!ymd) return false
  const today =
    todayYmd ||
    ymdFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate())
  return ymd < today
}
