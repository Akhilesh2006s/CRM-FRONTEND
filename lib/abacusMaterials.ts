import { canonicalDcRowCategory } from '@/lib/dcRowCategory'

export type AbacusMaterialRow = { product?: string; productName?: string; class?: string; category?: string; strength?: number; quantity?: number }

export function abacusStudentStrength(rows: AbacusMaterialRow[]): number {
  const byClass = new Map<string, number>()
  for (const row of rows) {
    if (!/abacus/i.test(String(row.product || row.productName || ''))) continue
    if (canonicalDcRowCategory(row.category) === 'Training Material') continue
    const className = String(row.class || '').trim()
    if (!className) continue
    byClass.set(className, Math.max(byClass.get(className) || 0, Number(row.strength ?? row.quantity) || 0))
  }
  return [...byClass.values()].reduce((sum, strength) => sum + strength, 0)
}

export function defaultMasterAbacusQuantity(strength: number): number {
  return strength < 100 ? 0 : Math.ceil(strength / 150)
}
