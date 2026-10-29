/** The CRM shows every calendar date as DD/MM/YYYY (mobile-view/src/utils/dateFormat.ts matches). */

/** YYYY-MM-DD (or an ISO date-time) to DD/MM/YYYY; '' when it is not a date. */
export function ymdToDmy(value?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** DD/MM/YYYY (also D/M/YYYY, with / . or -) to YYYY-MM-DD; null when it is not a real date. */
export function dmyToYmd(text: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(String(text || '').trim())
  if (!m) return null
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : iso
}

/** Any date value as DD/MM/YYYY ('' when missing or invalid). */
export function formatDate(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return ymdToDmy(value)
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
