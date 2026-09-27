'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'

type StockRequest = {
  _id: string
  productName: string
  category?: string
  level?: string
  specs?: string
  subject?: string
  quantity: number
  batchLot?: string
  unit?: string
  stockDate?: string
  supplier?: string
  location?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected' | 'returned'
  reviewRemarks?: string
  createdAt?: string
  submittedBy?: { _id?: string; name?: string; email?: string }
  reviewedBy?: { name?: string }
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Manager Approval',
  approved: 'Stock Confirmed',
  rejected: 'Rejected',
  returned: 'Returned for Correction',
}

export default function PendingStockApprovalsPage() {
  const role = getCurrentUser()?.role || ''
  const isManager = role === 'Warehouse Manager' || role === 'Admin' || role === 'Super Admin'
  const isExecutive = role === 'Warehouse Executive'
  const [rows, setRows] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(isManager ? 'pending' : '')
  const [selected, setSelected] = useState<StockRequest | null>(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftQty, setDraftQty] = useState('')
  const [draftBatch, setDraftBatch] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  const [draftNotes, setDraftNotes] = useState('')

  async function load(nextStatus = status) {
    setLoading(true)
    try {
      const query = nextStatus ? `?status=${encodeURIComponent(nextStatus)}` : ''
      const data = await apiRequest<StockRequest[]>(`/warehouse/stock-requests${query}`)
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load stock approvals')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  function openRow(row: StockRequest) {
    setSelected(row)
    setRemarks('')
    setDraftQty(String(row.quantity ?? ''))
    setDraftBatch(row.batchLot || '')
    setDraftLocation(row.location || '')
    setDraftNotes(row.notes || '')
  }

  async function decide(action: 'approve' | 'reject' | 'return') {
    if (!selected) return
    setBusy(true)
    try {
      await apiRequest(`/warehouse/stock-requests/${selected._id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action, remarks }),
      })
      toast.success(
        action === 'approve'
          ? 'Stock confirmed and added to warehouse inventory.'
          : action === 'return'
            ? 'Sent back to the Warehouse Executive for correction.'
            : 'Stock request rejected.'
      )
      setSelected(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to update this stock request')
    } finally {
      setBusy(false)
    }
  }

  async function resubmit() {
    if (!selected) return
    const amount = Number(draftQty)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive quantity')
      return
    }
    if (!draftBatch.trim() || !draftLocation.trim()) {
      toast.error('Batch / lot and warehouse location are required')
      return
    }
    setBusy(true)
    try {
      await apiRequest(`/warehouse/stock-requests/${selected._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          quantity: amount,
          batchLot: draftBatch.trim(),
          location: draftLocation.trim(),
          notes: draftNotes,
          resubmit: true,
        }),
      })
      toast.success('Corrected stock resubmitted for manager approval.')
      setSelected(null)
      load()
    } catch (err: any) {
      toast.error(err?.message || 'Unable to resubmit')
    } finally {
      setBusy(false)
    }
  }

  const title = isExecutive && !isManager ? 'My Stock Requests' : 'Pending Stock Approvals'
  const counts = useMemo(() => rows.length, [rows])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{title}</h1>
          <p className="text-neutral-500">
            Stock stays out of inventory until a Warehouse Manager approves it.
          </p>
        </div>
        <select
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="pending">Pending Manager Approval</option>
          <option value="returned">Returned for Correction</option>
          <option value="approved">Stock Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <Card className="p-4 md:p-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">
                    No stock requests{status ? ` with status ${STATUS_LABEL[status] || status}` : ''}.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell>{row.quantity} {row.unit || ''}</TableCell>
                  <TableCell>{row.batchLot || '-'}</TableCell>
                  <TableCell>{row.location || '-'}</TableCell>
                  <TableCell>{row.supplier || '-'}</TableCell>
                  <TableCell>{row.submittedBy?.name || '-'}</TableCell>
                  <TableCell>{STATUS_LABEL[row.status] || row.status}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openRow(row)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!loading && <p className="mt-3 text-xs text-neutral-500">{counts} request{counts === 1 ? '' : 's'}</p>}
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.productName}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p><span className="text-neutral-500">Status:</span> {STATUS_LABEL[selected.status]}</p>
              <p><span className="text-neutral-500">Quantity:</span> {selected.quantity} {selected.unit || 'pcs'}</p>
              <p><span className="text-neutral-500">Batch / Lot:</span> {selected.batchLot || '-'}</p>
              <p><span className="text-neutral-500">Date:</span> {selected.stockDate ? new Date(selected.stockDate).toLocaleDateString() : '-'}</p>
              <p><span className="text-neutral-500">Supplier:</span> {selected.supplier || '-'}</p>
              <p><span className="text-neutral-500">Location:</span> {selected.location || '-'}</p>
              <p><span className="text-neutral-500">Category / Level / Specs:</span> {[selected.category, selected.level, selected.specs, selected.subject].filter(Boolean).join(' · ') || '-'}</p>
              {selected.notes ? <p><span className="text-neutral-500">Notes:</span> {selected.notes}</p> : null}
              {selected.reviewRemarks ? <p><span className="text-neutral-500">Manager remarks:</span> {selected.reviewRemarks}</p> : null}

              {isExecutive && selected.status === 'returned' && (
                <div className="space-y-2 border-t pt-3">
                  <Input value={draftQty} onChange={(e) => setDraftQty(e.target.value)} placeholder="Quantity" type="number" />
                  <Input value={draftBatch} onChange={(e) => setDraftBatch(e.target.value)} placeholder="Batch / lot" />
                  <Input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Warehouse location" />
                  <Textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} placeholder="Notes" />
                </div>
              )}

              {isManager && selected.status === 'pending' && (
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Remarks (required to reject or return)"
                />
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            {isExecutive && selected?.status === 'returned' && (
              <Button disabled={busy} onClick={resubmit}>{busy ? 'Saving…' : 'Resubmit'}</Button>
            )}
            {isManager && selected?.status === 'pending' && (
              <>
                <Button variant="destructive" disabled={busy} onClick={() => decide('reject')}>Reject</Button>
                <Button variant="outline" disabled={busy} onClick={() => decide('return')}>Return for correction</Button>
                <Button disabled={busy} onClick={() => decide('approve')}>Approve</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
