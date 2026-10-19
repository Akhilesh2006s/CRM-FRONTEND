/** Mirror of backend utils/deliverableStockRows.js: a "CW, HW" row needs each book at the row's
 * quantity, because warehouse stock is kept per deliverable. */
export function expandDeliverableStockRows<T extends { subject?: string | null }>(rows: T[]): T[] {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const subjects = String(row?.subject || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (subjects.length < 2) return [row]
    return subjects.map((subject) => ({ ...row, subject }))
  })
}
