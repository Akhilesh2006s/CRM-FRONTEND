'use client'

import { type LeaveAllocation, SOURCE_LABELS, shortDay, fmtDays } from '@/lib/leavePolicy'

/** How a leave's days are paid: monthly leave, comp-off or loss of pay, with sandwich days. */
export function LeavePaymentBreakdown({ allocation, compact = false }: { allocation: LeaveAllocation | null; compact?: boolean }) {
  if (!allocation || !allocation.entries) return null
  const { chargedDays, monthlyDays, compOffDays, lopDays, sandwichDates } = allocation
  if (compact) {
    return (
      <div className="text-xs text-neutral-600 space-y-0.5">
        <div>Charged: {fmtDays(chargedDays)}</div>
        {sandwichDates.length > 0 && <div className="text-amber-700">Sandwich: {sandwichDates.map(shortDay).join(', ')}</div>}
        {lopDays > 0 && <div className="text-red-700">Loss of pay: {fmtDays(lopDays)}</div>}
      </div>
    )
  }
  return (
    <div className="rounded-md border bg-neutral-50 p-3 text-sm space-y-2">
      <div className="font-medium text-neutral-900">Leave counted: {fmtDays(chargedDays)}</div>
      {sandwichDates.length > 0 && (
        <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Sandwich: {sandwichDates.map(shortDay).join(', ')} {sandwichDates.length === 1 ? 'counts' : 'count'} as leave
          (leave on the working day before and after).
        </div>
      )}
      <ul className="space-y-0.5 text-neutral-700">
        {monthlyDays > 0 && <li>{SOURCE_LABELS.monthly}: {fmtDays(monthlyDays)}</li>}
        {compOffDays > 0 && <li>{SOURCE_LABELS.compoff}: {fmtDays(compOffDays)}</li>}
        {lopDays > 0 && <li className="text-red-700 font-medium">{SOURCE_LABELS.lop}: {fmtDays(lopDays)}</li>}
        {chargedDays === 0 && <li>No working days in this range (Sundays / company holidays).</li>}
      </ul>
    </div>
  )
}
