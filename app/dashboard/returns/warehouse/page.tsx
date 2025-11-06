'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

type WarehouseReturn = { _id: string; returnNumber: number; returnDate: string; createdAt: string; createdBy?: { name?: string }; remarks?: string; lrNumber?: string; finYear?: string }

export default function WarehouseReturnsPage() {
  const [returnDate, setReturnDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [finYear, setFinYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<WarehouseReturn[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<WarehouseReturn[]>(`/stock-returns/warehouse`)
      setList(data)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!returnDate) { toast({ title: 'Validation', description: 'Please select Return Date', variant: 'destructive' }); return }
    setLoading(true)
    try {
      const created = await apiRequest<WarehouseReturn>(`/stock-returns/warehouse`, { method: 'POST', body: JSON.stringify({ returnDate, remarks, lrNumber, finYear }) })
      toast({ title: 'Warehouse Return Submitted', description: `Return #${created.returnNumber} created` })
      setReturnDate(''); setRemarks(''); setLrNumber(''); setFinYear('')
      await load()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Warehouse Returns</h1>

      <Card className="p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className="text-sm text-muted-foreground">Return Date</label><Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
          <div><label className="text-sm text-muted-foreground">LR No (optional)</label><Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} placeholder="e.g. C062455" /></div>
          <div><label className="text-sm text-muted-foreground">Fin Year (optional)</label><Input value={finYear} onChange={(e) => setFinYear(e.target.value)} placeholder="e.g. 2025-26" /></div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground">Remarks</label>
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason/notes or items summary" />
        </div>
        <div>
          <Button onClick={submit} disabled={loading}>{loading ? 'Submitting…' : 'Submit Warehouse Return'}</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-medium">All Warehouse Returns</h2>{loading && <span className="text-sm text-muted-foreground">Loading…</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Return #</th><th className="py-2 pr-2">Return Date</th><th className="py-2 pr-2">LR No</th><th className="py-2 pr-2">Fin Year</th><th className="py-2 pr-2">Submitted By</th><th className="py-2 pr-2">Remarks</th><th className="py-2 pr-2">Created</th></tr></thead>
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
                </tr>
              ))}
              {list.length === 0 && (<tr><td className="py-3 text-muted-foreground" colSpan={7}>No returns</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


