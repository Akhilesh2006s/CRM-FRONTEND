'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Eye } from 'lucide-react'

type ExecReturn = {
  _id: string
  returnNumber: number
  returnDate: string
  createdAt: string
  status?: string
  createdBy?: { name?: string }
  executiveName?: string
  leadId?: { school_name?: string }
  dcOrderId?: { school_name?: string }
  remarks?: string
  lrNumber?: string
  finYear?: string
  rejectionReason?: string
  managerRemarks?: string
  verifiedBy?: { name?: string }
  approvedBy?: { name?: string }
}
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
  rejectionReason?: string
  managerRemarks?: string
}

function unwrapList<T>(response: unknown): T[] {
  return Array.isArray(response) ? response : (response as { data?: T[] })?.data ?? []
}

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
      setExecutive(unwrapList(execData))
      setWarehouse(unwrapList(whData))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Returns Report</h1>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Executive Returns</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Return #</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Executive</th>
                <th className="py-2 pr-2">Lead / School</th>
                <th className="py-2 pr-2">LR No</th>
                <th className="py-2 pr-2">Fin Year</th>
                <th className="py-2 pr-2">Return Date</th>
                <th className="py-2 pr-2">WH Exec</th>
                <th className="py-2 pr-2">Manager</th>
                <th className="py-2 pr-2">Rejection / remarks</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {executive.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.status || '-'}</td>
                  <td className="py-2 pr-2">
                    {r.executiveName || r.createdBy?.name || '-'}
                  </td>
                  <td className="py-2 pr-2">
                    {r.leadId?.school_name || r.dcOrderId?.school_name || '-'}
                  </td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">
                    {new Date(r.returnDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-2">{r.verifiedBy?.name || '-'}</td>
                  <td className="py-2 pr-2">{r.approvedBy?.name || '-'}</td>
                  <td className="py-2 pr-2 max-w-[240px]">
                    {r.rejectionReason ? (
                      <span className="text-red-700 text-xs" title={r.rejectionReason}>
                        {r.rejectionReason}
                      </span>
                    ) : (
                      <span
                        className="text-xs text-muted-foreground truncate block"
                        title={r.managerRemarks || r.remarks || ''}
                      >
                        {r.managerRemarks || r.remarks || '-'}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <Link
                      href={`/dashboard/returns/employees/${r._id}`}
                      className="inline-flex items-center text-primary hover:underline text-xs"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {executive.length === 0 && (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={11}>
                    No executive returns
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Warehouse Returns</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Return #</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Manager</th>
                <th className="py-2 pr-2">LR No</th>
                <th className="py-2 pr-2">Fin Year</th>
                <th className="py-2 pr-2">Return Date</th>
                <th className="py-2 pr-2">Remarks</th>
                <th className="py-2 pr-2">Rejection</th>
                <th className="py-2 pr-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {warehouse.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.status || '-'}</td>
                  <td className="py-2 pr-2">{r.createdBy?.name || '-'}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">
                    {new Date(r.returnDate).toLocaleDateString()}
                  </td>
                  <td
                    className="py-2 pr-2 max-w-[200px] truncate"
                    title={r.remarks || ''}
                  >
                    {r.remarks || '-'}
                  </td>
                  <td className="py-2 pr-2 text-red-700 text-xs">
                    {r.rejectionReason || '-'}
                  </td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {warehouse.length === 0 && (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={9}>
                    No warehouse returns
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
