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
  assigned_to?: { name?: string } | string | null
}

/**
 * Read-only list of DCs the Coordinator raised that now sit with the Senior Coordinator
 * (DcOrder status dc_sent_to_senior), so the Coordinator can still see where they are.
 */
export function SentToSeniorList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<SentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest<any>('/dc-orders?status=dc_sent_to_senior&limit=200')
      const list: SentOrder[] = Array.isArray(res) ? res : res?.data || []
      setRows(list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))))
    } catch (e: any) {
      setError(e?.message || 'Could not load DCs sent to the Senior Coordinator.')
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
          <h2 className="text-lg font-semibold text-slate-900">Sent to Senior Coordinator</h2>
          <p className="text-xs text-slate-500">DCs you raised that are waiting for the Senior Coordinator to submit them to the warehouse.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={load}>Refresh</Button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600 py-4 text-center">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">Nothing is waiting with the Senior Coordinator.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-600">
                <th className="py-2 pr-3 font-semibold">School</th>
                <th className="py-2 pr-3 font-semibold">Code</th>
                <th className="py-2 pr-3 font-semibold">Zone</th>
                <th className="py-2 pr-3 font-semibold">BDE</th>
                <th className="py-2 pr-3 font-semibold">Sent on</th>
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
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="py-2">
                    <span className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">
                      With Senior Coordinator
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
