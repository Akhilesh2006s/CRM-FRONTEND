'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

type SentOrder = {
  _id: string
  school_name?: string
  school_code?: string
  dc_code?: string
  zone?: string
  updatedAt?: string
  status?: string
  workflowStage?: string
  assigned_to?: { name?: string } | string | null
}

/** Where a raised DC is now: Senior Coordinator, warehouse, or delivered. */
function stageLabel(row: SentOrder): { label: string; className: string } {
  if (row.status === 'completed' || row.workflowStage === 'CompletedDC') {
    return { label: 'Completed', className: 'bg-green-100 text-green-800' }
  }
  if (row.workflowStage === 'EmpDC') return { label: 'At Warehouse', className: 'bg-blue-100 text-blue-800' }
  return { label: 'With Senior Coordinator', className: 'bg-amber-100 text-amber-800' }
}

/**
 * Read-only list of DCs the Coordinator raised after they leave Closed Sales (with the Senior
 * Coordinator, at the warehouse, or completed), so the Coordinator can follow each DC's status.
 */
export function SentToSeniorList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<SentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const lists = await Promise.all(
        ['dc_sent_to_senior', 'completed'].map((status) =>
          apiRequest<any>(`/dc-orders?status=${status}&limit=200`).catch(() => [])
        )
      )
      const list: SentOrder[] = lists.flatMap((res) => (Array.isArray(res) ? res : res?.data || []))
      setRows(list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))))
    } catch (e: any) {
      setError(e?.message || 'Could not load DC status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">DC Status</h2>
          <p className="text-xs text-slate-500">DCs you raised and where each one is now: with the Senior Coordinator, at the warehouse, or completed.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-4 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">No DCs raised yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="py-2 pr-3 font-semibold">School</th>
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Zone</th>
                <th className="py-2 pr-3 font-semibold">BDE</th>
                <th className="py-2 pr-3 font-semibold">Updated</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-900">{row.school_name || '-'}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-blue-700">{row.school_code || row.dc_code || '-'}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.zone || '-'}</td>
                  <td className="py-2 pr-3 text-slate-700">
                    {typeof row.assigned_to === 'object' && row.assigned_to ? row.assigned_to.name || '-' : '-'}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                  </td>
                  <td className="py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${stageLabel(row).className}`}>
                      {stageLabel(row).label}
                    </span>
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
