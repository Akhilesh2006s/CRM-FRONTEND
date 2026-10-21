/** Deliverables are shown one per row (CW on one line, HW below). A saved "CW, HW" row becomes one
 * row per deliverable at the same quantity; the row's line id is dropped so each part gets its own. */
export function splitDeliverableRows<T extends Record<string, any>>(rows: T[]): T[] {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const subjects = String(row?.subject || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (subjects.length < 2) return [row]
    return subjects.map((subject) => {
      const { lineId: _lineId, ...rest } = row as Record<string, any>
      return { ...rest, subject, selected_subjects: [subject] } as unknown as T
    })
  })
}

/** A specimen line's specs name the line ("Specimen for ABACUS"), not a stock spec: match any spec. */
function withoutSpecimenSpecs<T extends { specs?: string | null }>(row: T): T {
  const specs = String(row?.specs || '')
  return specs === 'Set as per DC list' || specs.startsWith('Specimen for ') ? { ...row, specs: '' } : row
}

/** Mirror of backend utils/deliverableStockRows.js: a "CW, HW" row needs each book at the row's
 * quantity, because warehouse stock is kept per deliverable. */
export function expandDeliverableStockRows<T extends { subject?: string | null; specs?: string | null }>(rows: T[]): T[] {
  return (Array.isArray(rows) ? rows : []).map(withoutSpecimenSpecs).flatMap((row) => {
    const subjects = String(row?.subject || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (subjects.length < 2) return [row]
    return subjects.map((subject) => ({ ...row, subject }))
  })
}
