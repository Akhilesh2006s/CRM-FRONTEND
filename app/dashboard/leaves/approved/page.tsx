'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { leaveTypeLabel } from '@/lib/leaveTypes'
import { LeaveDayTypeBadge } from '@/components/leaves/LeaveDayTypeBadge'
import { LeaveApprovalStatus, type LeaveApprovalFields } from '@/components/leaves/LeaveApprovalStatus'
import { LeaveBalanceCard } from '@/components/leaves/LeaveBalanceCard'
import { LeavePaymentBreakdown } from '@/components/leaves/LeavePaymentBreakdown'
import { type Holiday, type LeaveAllocation, type LeaveBalance, longDay, shortDay } from '@/lib/leavePolicy'

type Leave = LeaveApprovalFields & {
  _id: string
  startDate: string
  endDate: string
  reason?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  leaveType?: string
  dayType?: string
  halfDaySession?: string | null
  days?: number
  allocation?: LeaveAllocation['entries']
  sandwichDates?: string[]
  chargedDays?: number
  lopDays?: number
}

/** Stored allocation of an approved leave as a breakdown (null for leaves approved before the policy). */
function allocationOf(l: Leave): LeaveAllocation | null {
  if (!l.allocation || l.allocation.length === 0) return null
  const sum = (src: string) => l.allocation!.filter((e) => e.source === src).reduce((t, e) => t + e.fraction, 0)
  return {
    entries: l.allocation,
    sandwichDates: l.sandwichDates || [],
    chargedDays: l.chargedDays ?? l.allocation.reduce((t, e) => t + e.fraction, 0),
    monthlyDays: sum('monthly'),
    compOffDays: sum('compoff'),
    lopDays: l.lopDays ?? sum('lop'),
  }
}

export default function EmployeeApprovedLeavesPage() {
  const { user } = usePermissions()
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>([])

  const load = async () => {
    if (!user?._id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const year = new Date().getFullYear()
      const [data, bal, hol] = await Promise.all([
        apiRequest<Leave[]>(`/leaves?employeeId=${user._id}`),
        apiRequest<LeaveBalance>('/leaves/balance').catch(() => null),
        apiRequest<{ holidays: Holiday[] }>(`/holidays?year=${year}`).catch(() => ({ holidays: [] as Holiday[] })),
      ])
      setItems(data)
      setBalance(bal)
      setHolidays(hol.holidays || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?._id) load()
  }, [user?._id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Leaves</h1>
        <p className="text-sm text-neutral-600 mt-1">
          A leave is approved only after both of your approvers approve it. Each approver&apos;s decision is shown below.
        </p>
      </div>
      <LeaveBalanceCard balance={balance} />
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3 text-left">Approval status</th>
                <th className="py-2 px-3 text-left">Leave counted</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-4 px-3 text-center text-neutral-500">
                    No leaves found
                  </td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">
                    <div>{leaveTypeLabel(l.leaveType)}</div>
                    <LeaveDayTypeBadge leave={l} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 align-top">
                    <LeaveApprovalStatus leave={l} />
                  </td>
                  <td className="py-2 px-3 align-top">
                    {allocationOf(l) ? <LeavePaymentBreakdown allocation={allocationOf(l)} compact /> : <span className="text-neutral-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-semibold text-neutral-900 mb-2">Holidays Worked</h2>
          {(balance?.holidayWorked || []).length === 0 ? (
            <p className="text-sm text-neutral-500">No Sundays or company holidays worked yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {balance!.holidayWorked.map((h) => (
                <li key={h.date} className="py-1.5 flex items-center justify-between gap-2">
                  <span>{shortDay(h.date)} · {h.name}</span>
                  <span className="text-xs rounded bg-emerald-50 text-emerald-700 px-2 py-0.5">Comp-Off Earned</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold text-neutral-900 mb-2">Company Holidays ({holidays.length} / 12)</h2>
          {holidays.length === 0 ? (
            <p className="text-sm text-neutral-500">HR has not added this year&apos;s holiday calendar yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {holidays.map((h) => (
                <li key={h._id} className="py-1.5 flex justify-between gap-2">
                  <span>{h.name}</span>
                  <span className="text-neutral-600">{longDay(h.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
