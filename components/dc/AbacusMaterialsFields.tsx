'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Student / Master Abacus + Flash Card fields shown inside the DC product forms. */
export function AbacusMaterialsFields({
  studentQuantity,
  masterQuantity,
  masterQuantityInput,
  onMasterQuantityChange,
  masterUnitPrice,
  onMasterUnitPriceChange,
  hint,
  disabled = false,
}: {
  studentQuantity: number
  masterQuantity: number
  masterQuantityInput: string
  onMasterQuantityChange: (value: string) => void
  masterUnitPrice: string
  onMasterUnitPriceChange: (value: string) => void
  hint?: string
  disabled?: boolean
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="font-semibold">First DC · Abacus materials</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Student Abacus quantity (one per student)</Label><Input type="number" value={studentQuantity} readOnly disabled /></div>
        <div><Label>Flash Card sets (with Master Abacus)</Label><Input type="number" value={masterQuantity} readOnly disabled /></div>
        <div><Label>Master Abacus quantity</Label><Input type="number" min="0" step="1" disabled={disabled} value={masterQuantityInput} onChange={(event) => onMasterQuantityChange(event.target.value)} /></div>
        <div><Label>Master Abacus unit price (₹, if charged)</Label><Input type="number" min="0" step="0.01" disabled={disabled} value={masterUnitPrice} onChange={(event) => onMasterUnitPriceChange(event.target.value)} /></div>
      </div>
      {hint && <p className="text-xs text-neutral-600">{hint}</p>}
    </div>
  )
}
