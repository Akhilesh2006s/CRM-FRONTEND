/** Local calendar date as YYYY-MM-DD (for date input min attributes). */
export function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isBeforeToday(dateStr: string): boolean {
  if (!dateStr) return false
  return dateStr < todayDateString()
}
