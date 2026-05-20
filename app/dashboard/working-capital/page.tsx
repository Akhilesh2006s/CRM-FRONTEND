'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type BranchSummary = {
  branch_id: string
  branch_name?: string
  city?: string
  state?: string
  oem?: string
  total_vehicles: number
  wcx_vehicle_count: number
  working_capital_locked_inr: number
  interest_exposure_inr: number
  high_risk_count: number
  critical_count: number
}

type WorkingCapitalResponse = {
  branches: BranchSummary[]
  totals: {
    branches: number
    vehicles: number
    wcx_vehicles: number
    working_capital_locked_inr: number
    interest_exposure_inr: number
    high_risk_count: number
    critical_count: number
  }
}

export default function WorkingCapitalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Working Capital Exposure</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Dealer-level working capital exposure summary from your Inventory_Analysis and Working_Capital_Exposure
          sheets.
        </p>
      </div>

      <WorkingCapitalContent />
    </div>
  )
}

function WorkingCapitalContent() {
  const [data, setData] = useState<WorkingCapitalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiRequest<WorkingCapitalResponse>('/dms/analytics/working-capital')
        setData(res)
      } catch (e: any) {
        console.error('Failed to load working capital summary', e)
        setError(e?.message || 'Failed to load working capital summary')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-neutral-600">Loading working capital exposure…</p>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-red-600 mb-1">Failed to load working capital exposure.</p>
        {error && <p className="text-xs text-neutral-500 whitespace-pre-line">{error}</p>}
      </Card>
    )
  }

  const { totals, branches } = data

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div>
            <div className="text-xs text-neutral-500">Branches in scope</div>
            <div className="text-xl font-semibold text-neutral-900">{totals.branches}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Vehicles (total / WCX)</div>
            <div className="text-xl font-semibold text-neutral-900">
              {totals.vehicles.toLocaleString('en-IN', { maximumFractionDigits: 0 })}{' '}
              <span className="text-xs text-neutral-500">
                ({totals.wcx_vehicles.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in WCX)
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Working Capital Locked (₹)</div>
            <div className="text-xl font-semibold text-neutral-900">
              {totals.working_capital_locked_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Interest Exposure (₹)</div>
            <div className="text-xl font-semibold text-neutral-900">
              {totals.interest_exposure_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {branches.length === 0 ? (
          <div className="p-4 text-sm text-neutral-500">
            No branches found. Make sure DMS branches, vehicles, and WCX data are seeded.
          </div>
        ) : (
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">Branch</th>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-right">Vehicles</th>
                <th className="px-3 py-2 text-right">WCX Vehicles</th>
                <th className="px-3 py-2 text-right">Working Capital (₹)</th>
                <th className="px-3 py-2 text-right">Interest Exposure (₹)</th>
                <th className="px-3 py-2 text-right">High / Critical</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.branch_id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{b.branch_name || b.branch_id}</div>
                    <div className="text-[11px] text-neutral-500">{b.branch_id}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {b.city || '-'}
                    {b.state ? `, ${b.state}` : ''}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {b.total_vehicles.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {b.wcx_vehicle_count.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {b.working_capital_locked_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {b.interest_exposure_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
                        H: {b.high_risk_count}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                        C: {b.critical_count}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

