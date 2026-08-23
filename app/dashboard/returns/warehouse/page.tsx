'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

type WarehouseReturn = {
  _id: string
  returnNumber: number
  returnDate: string
  createdAt: string
  status?: string
  createdBy?: { name?: string }
  remarks?: string
  lrNumber?: string
  finYear?: string
}

export default function WarehouseReturnsPage() {
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [list, setList] = useState<WarehouseReturn[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const response = await apiRequest<WarehouseReturn[] | { data?: WarehouseReturn[] }>(`/stock-returns/warehouse`)
      const rows = Array.isArray(response) ? response : (response?.data ?? [])
      // Pending warehouse-list rows only — Closed means already submitted from this page
      setList(rows.filter((r) => r.status !== 'Closed'))
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submitReturn = async (returnId: string, returnNumber: number) => {
    if (!returnId) return
    setSubmittingId(returnId)
    try {
      await apiRequest(`/stock-returns/${returnId}/warehouse-submit`, { method: 'PUT' })
      toast({
        title: 'Return submitted',
        description: `Return #${returnNumber} submitted successfully`,
      })
      await load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to submit return', variant: 'destructive' })
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Warehouse Returns</h1>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">All Warehouse Returns</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Return #</th>
                <th className="py-2 pr-2">Return Date</th>
                <th className="py-2 pr-2">LR No</th>
                <th className="py-2 pr-2">Fin Year</th>
                <th className="py-2 pr-2">Submitted By</th>
                <th className="py-2 pr-2">Remarks</th>
                <th className="py-2 pr-2">Created</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">{r.createdBy?.name || '-'}</td>
                  <td className="py-2 pr-2 max-w-[360px] truncate" title={r.remarks || ''}>{r.remarks || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-2">
                    <Button
                      size="sm"
                      disabled={loading || submittingId === r._id}
                      onClick={() => submitReturn(r._id, r.returnNumber)}
                    >
                      {submittingId === r._id ? 'Submitting…' : 'Submit'}
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={8}>No returns</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
