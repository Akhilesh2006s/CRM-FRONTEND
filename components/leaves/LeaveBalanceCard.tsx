'use client'

import { Card } from '@/components/ui/card'
import { type LeaveBalance, longDay, fmtDays } from '@/lib/leavePolicy'

/** Paid leave this month, comp-offs (holidays worked) and loss of pay this year. */
export function LeaveBalanceCard({ balance }: { balance: LeaveBalance | null }) {
  if (!balance) return null
  const { monthlyPaidLeave: m, compOff: c } = balance
  return (
    <Card className="p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Paid leave this month (used)</div>
          <div className="text-2xl font-semibold text-neutral-900">
            {m.used} <span className="text-sm font-normal text-neutral-500">/ {m.allowance} · {m.remaining > 0 ? `${m.remaining} left` : 'none left'}</span>
          </div>
          <div className="text-xs text-neutral-500">Sick Leave or Company Paid Leave, no salary deduction</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Comp-Offs available</div>
          <div className="text-2xl font-semibold text-emerald-700">{c.available}</div>
          <div className="text-xs text-neutral-500">
            {c.earned} earned, {c.used} used ·{' '}
            {c.resetsOn ? `Comp-Offs reset on ${longDay(c.resetsOn)}` : 'Comp-Offs carry forward'}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500">Loss of pay this year</div>
          <div className={`text-2xl font-semibold ${balance.lopDaysThisYear > 0 ? 'text-red-700' : 'text-neutral-900'}`}>
            {fmtDays(balance.lopDaysThisYear)}
          </div>
          <div className="text-xs text-neutral-500">Financial year {c.financialYear}</div>
        </div>
      </div>
    </Card>
  )
}
