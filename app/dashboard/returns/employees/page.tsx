'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'
import { toast } from '@/hooks/use-toast'
import { PlusCircle, X } from 'lucide-react'

type Lead = { _id: string; school_name: string; contact_person?: string; location?: string }
type ProductRow = { id: string; product: string; soldQty: number; returnQty: number; reason: string; remarks: string }
type ExecReturn = {
  _id: string
  returnNumber: number
  returnDate: string
  createdAt: string
  status?: string
  remarks?: string
  lrNumber?: string
  finYear?: string
  schoolType?: string
  schoolCode?: string
  leadId?: { school_name?: string }
}

const RETURN_REASONS = ['Damaged', 'Expired', 'Wrong Item', 'Excess Stock', 'Other']

function unwrapList<T>(response: any): T[] {
  return Array.isArray(response) ? response : response?.data ?? []
}

export default function EmployeeReturnsPage() {
  const { productNames } = useProducts()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [returnDate, setReturnDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [finYear, setFinYear] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [myReturns, setMyReturns] = useState<ExecReturn[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { id: '1', product: '', soldQty: 0, returnQty: 0, reason: '', remarks: '' },
  ])

  const user = useMemo(() => getCurrentUser(), [])
  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin'

  const loadReturns = async () => {
    const endpoint = isAdmin ? '/stock-returns/executive' : '/stock-returns/executive/mine'
    const response = await apiRequest<any>(endpoint)
    setMyReturns(unwrapList<ExecReturn>(response))
  }

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return
      setLoading(true)
      try {
        if (!isAdmin) {
          const response = await apiRequest<any>(`/leads?employee=${user._id}`)
          setLeads(unwrapList<Lead>(response))
        } else {
          setLeads([])
        }
        await loadReturns()
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' })
        setLeads([])
        setMyReturns([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?._id, isAdmin])

  const openMarkReturned = (lead: Lead) => {
    if (!returnDate) {
      toast({ title: 'Validation', description: 'Please select Return Date first', variant: 'destructive' })
      return
    }
    setSelectedLead(lead)
    setProductRows([{ id: '1', product: '', soldQty: 0, returnQty: 0, reason: '', remarks: '' }])
    setDialogOpen(true)
  }

  const addProductRow = () => {
    setProductRows((rows) => [
      ...rows,
      { id: String(Date.now()), product: '', soldQty: 0, returnQty: 0, reason: '', remarks: '' },
    ])
  }

  const removeProductRow = (id: string) => {
    if (productRows.length <= 1) return
    setProductRows((rows) => rows.filter((r) => r.id !== id))
  }

  const submitReturn = async () => {
    if (!selectedLead || !returnDate) return

    const validProducts = productRows.filter(
      (p) => p.product.trim() && p.reason.trim() && p.returnQty > 0
    )
    if (validProducts.length === 0) {
      toast({
        title: 'Validation',
        description: 'Add at least one product with return quantity and reason',
        variant: 'destructive',
      })
      return
    }

    for (const p of validProducts) {
      if (p.returnQty > p.soldQty) {
        toast({
          title: 'Validation',
          description: `Return qty cannot exceed sold qty for ${p.product}`,
          variant: 'destructive',
        })
        return
      }
    }

    setSubmittingId(selectedLead._id)
    try {
      const created = await apiRequest<ExecReturn>(`/stock-returns/executive`, {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead._id,
          returnDate,
          remarks,
          lrNumber,
          finYear,
          schoolType,
          schoolCode,
          customerName: selectedLead.school_name,
          products: validProducts.map((p) => ({
            product: p.product,
            soldQty: p.soldQty,
            returnQty: p.returnQty,
            reason: p.reason,
            remarks: p.remarks || undefined,
          })),
        }),
      })
      toast({
        title: 'Stock Return Submitted',
        description: `Return #${created.returnNumber} created (${created.status || 'Submitted'})`,
      })
      await loadReturns()
      setDialogOpen(false)
      setSelectedLead(null)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Employee Stock Returns</h1>

      <Card className="p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-sm text-muted-foreground">Return Date *</Label>
            <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">LR No (optional)</Label>
            <Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} placeholder="e.g. C062455" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Fin Year (optional)</Label>
            <Input value={finYear} onChange={(e) => setFinYear(e.target.value)} placeholder="e.g. 2025-26" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">School Type (optional)</Label>
            <Input value={schoolType} onChange={(e) => setSchoolType(e.target.value)} placeholder="New / Existing" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">School Code (optional)</Label>
            <Input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} placeholder="e.g. VJVIJ5050" />
          </div>
          <div className="md:col-span-3">
            <Label className="text-sm text-muted-foreground">Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason/notes for return" />
          </div>
        </div>
      </Card>

      {!isAdmin && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">My Assigned Leads</h2>
            {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-2">School</th>
                  <th className="py-2 pr-2">Contact</th>
                  <th className="py-2 pr-2">Location</th>
                  <th className="py-2 pr-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead._id} className="border-b">
                    <td className="py-2 pr-2">{lead.school_name}</td>
                    <td className="py-2 pr-2">{lead.contact_person || '-'}</td>
                    <td className="py-2 pr-2">{lead.location || '-'}</td>
                    <td className="py-2 pr-2">
                      <Button
                        size="sm"
                        disabled={!!submittingId}
                        onClick={() => openMarkReturned(lead)}
                      >
                        {submittingId === lead._id ? 'Submitting…' : 'Mark Returned'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {leads.length === 0 && !loading && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={4}>
                      No assigned leads
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-medium mb-3">{isAdmin ? 'All Executive Returns' : 'My Returns'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2">Return #</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">LR No</th>
                <th className="py-2 pr-2">Fin Year</th>
                <th className="py-2 pr-2">Lead</th>
                <th className="py-2 pr-2">Return Date</th>
                <th className="py-2 pr-2">Remarks</th>
                <th className="py-2 pr-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {myReturns.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.status || '-'}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">{r.leadId?.school_name || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-2">{r.remarks || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {myReturns.length === 0 && (
                <tr>
                  <td className="py-3 text-muted-foreground" colSpan={8}>
                    No returns yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark Returned — {selectedLead?.school_name}</DialogTitle>
            <DialogDescription>
              Add at least one product with sold qty, return qty, and reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {productRows.map((row, idx) => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border-b pb-3">
                <div className="md:col-span-2">
                  <Label>Product *</Label>
                  <Select
                    value={row.product}
                    onValueChange={(v) => {
                      const next = [...productRows]
                      next[idx] = { ...next[idx], product: v }
                      setProductRows(next)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {productNames.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sold Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.soldQty || ''}
                    onChange={(e) => {
                      const next = [...productRows]
                      next[idx] = { ...next[idx], soldQty: Number(e.target.value) || 0 }
                      setProductRows(next)
                    }}
                  />
                </div>
                <div>
                  <Label>Return Qty *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.returnQty || ''}
                    onChange={(e) => {
                      const next = [...productRows]
                      next[idx] = { ...next[idx], returnQty: Number(e.target.value) || 0 }
                      setProductRows(next)
                    }}
                  />
                </div>
                <div>
                  <Label>Reason *</Label>
                  <Select
                    value={row.reason}
                    onValueChange={(v) => {
                      const next = [...productRows]
                      next[idx] = { ...next[idx], reason: v }
                      setProductRows(next)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1">
                  {productRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeProductRow(row.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addProductRow}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReturn} disabled={!!submittingId}>
              {submittingId ? 'Submitting…' : 'Submit Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
