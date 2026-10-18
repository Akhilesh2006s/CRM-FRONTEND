'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { ContractPeriod } from '@/components/clients/ContractPeriod'

export type DueRenewalRow = {
  _id: string
  school_name?: string
  school_code?: string
  dc_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  city?: string
  location?: string
  assigned_to?: { _id?: string; name?: string } | null
  productNames?: string[]
  contract_years?: number
  contract_start?: string
  contract_end?: string
  daysLeft: number
  hasOpenRenewalLead: boolean
}

const WINDOWS = [
  { value: '0', label: 'Ended (overdue) only' },
  { value: '30', label: 'Ending in 30 days' },
  { value: '60', label: 'Ending in 60 days' },
  { value: '90', label: 'Ending in 90 days' },
  { value: '180', label: 'Ending in 180 days' },
]

/**
 * Client schools whose contract ends within the chosen window (ended ones included), scoped
 * by the API: own schools for BDEs, the team's for Zonal Managers, all for Admin.
 */
export function DueRenewalsCard({
  onStartRenewal,
  refreshKey = 0,
}: {
  onStartRenewal: (row: DueRenewalRow) => void
  refreshKey?: number
}) {
  const [days, setDays] = useState('90')
  const [rows, setRows] = useState<DueRenewalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<{ data: DueRenewalRow[] }>(`/dc-orders/renewals-due?days=${days}`)
      const data = res?.data || []
      setRows(days === '0' ? data.filter((row) => row.daysLeft < 0) : data)
    } catch (e: any) {
      setError(e?.message || 'Could not load schools due for renewal.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Due for renewal</h2>
          <p className="text-xs text-neutral-600">Client schools whose contract has ended or ends soon.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Renewal window"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500 py-6 text-center">Loading…</p>
      ) : error ? (
        <div className="text-sm text-red-600 py-4 text-center space-x-2">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={load}>Retry</Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500 py-6 text-center">No client schools are due in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-600">
                <th className="py-2 pr-3 font-semibold">School</th>
                <th className="py-2 pr-3 font-semibold">BDE</th>
                <th className="py-2 pr-3 font-semibold">Products</th>
                <th className="py-2 pr-3 font-semibold">Contract</th>
                <th className="py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-neutral-900">{row.school_name || '-'}</div>
                    <div className="text-xs font-mono text-blue-700">{row.school_code || row.dc_code || '-'}</div>
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">{row.assigned_to?.name || '-'}</td>
                  <td className="py-2 pr-3 text-neutral-700 max-w-[260px]">{(row.productNames || []).join(', ') || '-'}</td>
                  <td className="py-2 pr-3"><ContractPeriod contract={row} /></td>
                  <td className="py-2 text-right">
                    {row.hasOpenRenewalLead ? (
                      <span className="inline-block rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">
                        Renewal lead open
                      </span>
                    ) : (
                      <Button type="button" size="sm" onClick={() => onStartRenewal(row)}>Start renewal</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
