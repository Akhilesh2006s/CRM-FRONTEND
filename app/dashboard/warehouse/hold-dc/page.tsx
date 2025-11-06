'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type HoldRow = {
  _id: string
  dcNo: string
  dcDate?: string
  dcFinYear?: string
  schoolType?: string
  schoolName?: string
  schoolCode?: string
  zone?: string
  executive?: string
  holdRemarks?: string
  isDcOrder?: boolean // true for DcOrder, false for DC model
}

export default function HoldDCPage() {
  const [rows, setRows] = useState<HoldRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      // Load both DcOrder holds and DC model holds
      const [dcOrderHolds, dcHolds] = await Promise.all([
        apiRequest<HoldRow[]>('/warehouse/hold-dc/list').catch(() => []),
        apiRequest<any[]>('/dc/hold').catch(() => [])
      ])
      
      // Mark DcOrder holds
      const markedDcOrderHolds: HoldRow[] = (dcOrderHolds || []).map((hold: HoldRow) => ({
        ...hold,
        isDcOrder: true,
      }))
      
      // Transform DC holds to match HoldRow format and mark as DC model
      const transformedDCHolds: HoldRow[] = (dcHolds || []).map((dc: any) => ({
        _id: dc._id,
        dcNo: dc._id ? `DC-${dc._id.slice(-6)}` : '',
        dcDate: dc.dcDate || dc.createdAt,
        dcFinYear: '',
        schoolType: dc.dcOrderId?.school_type || '',
        schoolName: dc.dcOrderId?.school_name || dc.customerName || '',
        schoolCode: dc.dcOrderId?.dc_code || '',
        zone: dc.dcOrderId?.zone || '',
        executive: dc.employeeId?.name || '',
        holdRemarks: dc.holdReason || '',
        isDcOrder: false, // DC model
      }))
      
      // Combine both lists
      const allHolds = [...markedDcOrderHolds, ...transformedDCHolds]
      setRows(allHolds)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load held DCs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function moveToWarehouse(row: HoldRow) {
    try {
      if (row.isDcOrder) {
        // For DcOrder: use the warehouse endpoint to toggle hold (changes from 'hold' to 'pending')
        await apiRequest(`/warehouse/dc/${row._id}/hold`, { method: 'POST' })
      } else {
        // For DC model: update status to pending_dc so it appears in DC @ Warehouse list
        await apiRequest(`/dc/${row._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'pending_dc',
            holdReason: '', // Clear hold reason when moving to warehouse
          }),
        })
      }
      
      // Remove from list after successful move
      setRows((prev) => prev.filter((r) => r._id !== row._id))
      toast.success('DC moved to warehouse successfully. It will appear in DC @ Warehouse list.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to move DC to warehouse')
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">DC Hold List</h1>
        <div className="overflow-x-auto mt-4">
          <Table className="w-full" style={{ minWidth: '1400px' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">S.No</TableHead>
                <TableHead>DC No</TableHead>
                <TableHead className="bg-slate-100 min-w-[180px] px-4">Action</TableHead>
                <TableHead>DC Date</TableHead>
                <TableHead>DC Fin Year</TableHead>
                <TableHead>School Type</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Executive</TableHead>
                <TableHead>Hold Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-neutral-500">No DCs on hold</TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow key={r._id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcNo}</TableCell>
                  <TableCell className="whitespace-nowrap bg-white min-w-[180px] px-4">
                    <Button variant="destructive" onClick={() => moveToWarehouse(r)}>
                      Move to DC@Warehouse
                    </Button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcDate ? new Date(r.dcDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcFinYear || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolType || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolCode || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.zone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.executive || '-'}</TableCell>
                  <TableCell className="truncate max-w-[240px]">{r.holdRemarks || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
