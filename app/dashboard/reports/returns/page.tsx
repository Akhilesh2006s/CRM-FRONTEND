'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

type ExecReturn = { _id: string; returnNumber: number; returnDate: string; createdAt: string; createdBy?: { name?: string }; leadId?: { school_name?: string }; remarks?: string; lrNumber?: string; finYear?: string }
type WarehouseReturn = { _id: string; returnNumber: number; returnDate: string; createdAt: string; createdBy?: { name?: string }; remarks?: string; lrNumber?: string; finYear?: string }

export default function ReturnsReportPage() {
  const [executive, setExecutive] = useState<ExecReturn[]>([])
  const [warehouse, setWarehouse] = useState<WarehouseReturn[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [execData, whData] = await Promise.all([
        apiRequest<ExecReturn[]>(`/stock-returns/executive`),
        apiRequest<WarehouseReturn[]>(`/stock-returns/warehouse`),
      ])
      setExecutive(execData); setWarehouse(whData)
    } catch (e: any) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Returns Report</h1>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-medium">Executive Returns</h2>{loading && <span className="text-sm text-muted-foreground">Loading…</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Return #</th><th className="py-2 pr-2">Executive</th><th className="py-2 pr-2">Lead</th><th className="py-2 pr-2">LR No</th><th className="py-2 pr-2">Fin Year</th><th className="py-2 pr-2">Return Date</th><th className="py-2 pr-2">Remarks</th><th className="py-2 pr-2">Created</th></tr></thead>
            <tbody>
              {executive.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.createdBy?.name || '-'}</td>
                  <td className="py-2 pr-2">{r.leadId?.school_name || '-'}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-2 max-w-[360px] truncate" title={r.remarks || ''}>{r.remarks || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {executive.length === 0 && (<tr><td className="py-3 text-muted-foreground" colSpan={8}>No executive returns</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-medium">Warehouse Returns</h2>{loading && <span className="text-sm text-muted-foreground">Loading…</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Return #</th><th className="py-2 pr-2">Manager</th><th className="py-2 pr-2">LR No</th><th className="py-2 pr-2">Fin Year</th><th className="py-2 pr-2">Return Date</th><th className="py-2 pr-2">Remarks</th><th className="py-2 pr-2">Created</th></tr></thead>
            <tbody>
              {warehouse.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.createdBy?.name || '-'}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-2 max-w-[360px] truncate" title={r.remarks || ''}>{r.remarks || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {warehouse.length === 0 && (<tr><td className="py-3 text-muted-foreground" colSpan={7}>No warehouse returns</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


