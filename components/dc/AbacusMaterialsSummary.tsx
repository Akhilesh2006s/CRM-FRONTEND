'use client'

export type AbacusMaterials = {
  studentAbacusQuantity?: number
  masterAbacusQuantity?: number
  flashCardSetsQuantity?: number
  masterAbacusUnitPrice?: number
  masterAbacusCharge?: number
}

/** Read-only Student Abacus / Master Abacus / Flash Cards lines that ship with an Abacus DC. */
export function AbacusMaterialsSummary({ materials }: { materials?: AbacusMaterials | null }) {
  if (!materials) return null
  const rows = [
    { label: 'Student Abacus', quantity: Number(materials.studentAbacusQuantity) || 0, note: 'One per Abacus student' },
    {
      label: 'Master Abacus',
      quantity: Number(materials.masterAbacusQuantity) || 0,
      note: Number(materials.masterAbacusCharge) > 0
        ? `₹${Number(materials.masterAbacusUnitPrice) || 0} each · ₹${Number(materials.masterAbacusCharge).toLocaleString('en-IN')} billed`
        : 'No charge',
    },
    { label: 'Flash Card sets', quantity: Number(materials.flashCardSetsQuantity) || 0, note: 'With the Master Abacus' },
  ].filter((row) => row.quantity > 0)
  if (!rows.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="text-sm font-semibold text-slate-900 mb-2">Abacus materials</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-600 border-b">
            <th className="py-1.5 pr-3 font-medium">Item</th>
            <th className="py-1.5 pr-3 font-medium">Quantity</th>
            <th className="py-1.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <td className="py-1.5 pr-3 font-medium text-slate-900">{row.label}</td>
              <td className="py-1.5 pr-3">{row.quantity}</td>
              <td className="py-1.5 text-slate-600">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
