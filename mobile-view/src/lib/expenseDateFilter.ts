/**
 * Search and Date / Month / Year filter used by every Expense list (app; the web has the same in
 * lib/expenseDateFilter.ts). Works on the expense date of each row.
 */
export type ExpenseDateFilter = { search: string; date: string; month: string; year: string }

export const EMPTY_EXPENSE_FILTER: ExpenseDateFilter = { search: '', date: '', month: '', year: '' }

export const MONTH_OPTIONS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Local YYYY-MM-DD of a date value, '' when missing. */
function dayKey(value: unknown): string {
  if (!value) return ''
  const d = new Date(value as string)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Text of a row for Search: its plain values plus the name / code of linked people. */
function rowText(row: Record<string, unknown>): string {
  const parts: string[] = []
  for (const v of Object.values(row || {})) {
    if (v == null) continue
    if (typeof v === 'string' || typeof v === 'number') parts.push(String(v))
    else if (typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      for (const k of ['name', 'employeeCode', 'code', 'email', 'mobile', 'zone']) if (o[k]) parts.push(String(o[k]))
    }
  }
  return parts.join(' ').toLowerCase()
}

/** Years to offer: this year back to the oldest expense shown. */
export function expenseYears<T>(rows: T[], dateOf: (row: T) => unknown = (r: any) => r?.date): string[] {
  const now = new Date().getFullYear()
  let oldest = now
  for (const r of rows) {
    const k = dayKey(dateOf(r))
    if (k) oldest = Math.min(oldest, Number(k.slice(0, 4)))
  }
  const out: string[] = []
  for (let y = now; y >= Math.max(oldest, now - 10); y -= 1) out.push(String(y))
  return out
}

export function filterExpenses<T>(rows: T[], f: ExpenseDateFilter, dateOf: (row: T) => unknown = (r: any) => r?.date): T[] {
  const q = f.search.trim().toLowerCase()
  if (!q && !f.date && !f.month && !f.year) return rows
  return rows.filter((r) => {
    const k = dayKey(dateOf(r))
    if (f.date && k !== f.date) return false
    if (f.year && k.slice(0, 4) !== f.year) return false
    if (f.month && Number(k.slice(5, 7)) !== Number(f.month)) return false
    if (q && !rowText(r as Record<string, unknown>).includes(q)) return false
    return true
  })
}
