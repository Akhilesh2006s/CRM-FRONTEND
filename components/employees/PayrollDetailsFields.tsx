'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Statutory details the monthly payroll uses (PF, ESI, PT, TDS). */
export type PayrollDetails = {
  uanNumber: string
  esiNumber: string
  pfApplicable: boolean
  esiApplicable: boolean
  ptApplicable: boolean
  monthlyTds: string
}

export const emptyPayrollDetails = (): PayrollDetails => ({
  uanNumber: '',
  esiNumber: '',
  pfApplicable: false,
  esiApplicable: false,
  ptApplicable: true,
  monthlyTds: '',
})

/** Form values from a saved employee (PF / ESI implied by a UAN / ESI number when not set). */
export function payrollDetailsFromEmployee(emp: Record<string, any>): PayrollDetails {
  const uan = String(emp?.uanNumber || '')
  const esi = String(emp?.esiNumber || '')
  return {
    uanNumber: uan,
    esiNumber: esi,
    pfApplicable: typeof emp?.pfApplicable === 'boolean' ? emp.pfApplicable : Boolean(uan.trim()),
    esiApplicable: typeof emp?.esiApplicable === 'boolean' ? emp.esiApplicable : Boolean(esi.trim()),
    ptApplicable: emp?.ptApplicable !== false,
    monthlyTds: emp?.monthlyTds ? String(emp.monthlyTds) : '',
  }
}

export function payrollDetailsPayload(v: PayrollDetails) {
  return {
    uanNumber: v.uanNumber.trim(),
    esiNumber: v.esiNumber.trim(),
    pfApplicable: v.pfApplicable,
    esiApplicable: v.esiApplicable,
    ptApplicable: v.ptApplicable,
    monthlyTds: Math.max(0, Number(v.monthlyTds) || 0),
  }
}

export function PayrollDetailsFields({ value, onChange }: { value: PayrollDetails; onChange: (next: PayrollDetails) => void }) {
  const set = (patch: Partial<PayrollDetails>) => onChange({ ...value, ...patch })
  const check = (key: 'pfApplicable' | 'esiApplicable' | 'ptApplicable', label: string) => (
    <label className="flex items-center gap-2 text-sm text-neutral-800 cursor-pointer">
      <input type="checkbox" className="h-4 w-4" checked={value[key]} onChange={(e) => set({ [key]: e.target.checked })} />
      {label}
    </label>
  )
  return (
    <div className="md:col-span-2 rounded-lg border border-neutral-200 p-3 space-y-3">
      <div>
        <div className="font-semibold text-neutral-900 text-sm">Payroll details</div>
        <p className="text-xs text-neutral-500">Used by monthly payroll: PF 12% of basic, ESI when gross is ₹21,000 or less, professional tax slab, TDS.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="uanNumber">UAN (PF) number</Label>
          <Input
            id="uanNumber"
            className="bg-white text-neutral-900"
            value={value.uanNumber}
            onChange={(e) => set({ uanNumber: e.target.value, ...(e.target.value.trim() && !value.uanNumber.trim() ? { pfApplicable: true } : {}) })}
            placeholder="Leave blank if not in PF"
          />
        </div>
        <div>
          <Label htmlFor="esiNumber">ESI number</Label>
          <Input
            id="esiNumber"
            className="bg-white text-neutral-900"
            value={value.esiNumber}
            onChange={(e) => set({ esiNumber: e.target.value, ...(e.target.value.trim() && !value.esiNumber.trim() ? { esiApplicable: true } : {}) })}
            placeholder="Leave blank if not in ESI"
          />
        </div>
        <div>
          <Label htmlFor="monthlyTds">Monthly TDS (₹)</Label>
          <Input id="monthlyTds" type="number" min="0" step="1" className="bg-white text-neutral-900" value={value.monthlyTds} onChange={(e) => set({ monthlyTds: e.target.value })} placeholder="0" />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {check('pfApplicable', 'PF applies')}
        {check('esiApplicable', 'ESI applies')}
        {check('ptApplicable', 'Professional tax applies')}
      </div>
    </div>
  )
}
