'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

type Lead = { _id: string; school_name: string; contact_person?: string; location?: string }
type ExecReturn = {
  _id: string; returnNumber: number; returnDate: string; createdAt: string;
  remarks?: string; lrNumber?: string; finYear?: string; schoolType?: string; schoolCode?: string;
  leadId?: { school_name?: string }
}

export default function EmployeeReturnsPage() {
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

  const user = useMemo(() => getCurrentUser(), [])

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return
      setLoading(true)
      try {
        const assignedLeads = await apiRequest<Lead[]>(`/leads?employee=${user._id}`)
        setLeads(assignedLeads)
        const mine = await apiRequest<ExecReturn[]>(`/stock-returns/executive/mine`)
        setMyReturns(mine)
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?._id])

  const submitReturn = async (leadId: string) => {
    if (!returnDate) { toast({ title: 'Validation', description: 'Please select Return Date', variant: 'destructive' }); return }
    setSubmittingId(leadId)
    try {
      const created = await apiRequest<ExecReturn>(`/stock-returns/executive`, {
        method: 'POST',
        body: JSON.stringify({ leadId, returnDate, remarks, lrNumber, finYear, schoolType, schoolCode }),
      })
      toast({ title: 'Stock Return Submitted', description: `Return #${created.returnNumber} created` })
      const mine = await apiRequest<ExecReturn[]>(`/stock-returns/executive/mine`)
      setMyReturns(mine)
      setReturnDate(''); setRemarks(''); setLrNumber(''); setFinYear(''); setSchoolType(''); setSchoolCode('')
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally { setSubmittingId(null) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Employee Stock Returns</h1>

      <Card className="p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div><label className="text-sm text-muted-foreground">Return Date</label><Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
          <div><label className="text-sm text-muted-foreground">LR No (optional)</label><Input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} placeholder="e.g. C062455" /></div>
          <div><label className="text-sm text-muted-foreground">Fin Year (optional)</label><Input value={finYear} onChange={(e) => setFinYear(e.target.value)} placeholder="e.g. 2025-26" /></div>
          <div><label className="text-sm text-muted-foreground">School Type (optional)</label><Input value={schoolType} onChange={(e) => setSchoolType(e.target.value)} placeholder="New / Existing" /></div>
          <div><label className="text-sm text-muted-foreground">School Code (optional)</label><Input value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} placeholder="e.g. VJVIJ5050" /></div>
          <div className="md:col-span-3"><label className="text-sm text-muted-foreground">Remarks</label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason/notes for return" /></div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3"><h2 className="font-medium">My Assigned Leads</h2>{loading && <span className="text-sm text-muted-foreground">Loading…</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">School</th><th className="py-2 pr-2">Contact</th><th className="py-2 pr-2">Location</th><th className="py-2 pr-2">Action</th></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead._id} className="border-b">
                  <td className="py-2 pr-2">{lead.school_name}</td>
                  <td className="py-2 pr-2">{lead.contact_person || '-'}</td>
                  <td className="py-2 pr-2">{lead.location || '-'}</td>
                  <td className="py-2 pr-2"><Button size="sm" disabled={!!submittingId} onClick={() => submitReturn(lead._id)}>{submittingId === lead._id ? 'Submitting…' : 'Mark Returned'}</Button></td>
                </tr>
              ))}
              {leads.length === 0 && !loading && (<tr><td className="py-3 text-muted-foreground" colSpan={4}>No assigned leads</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">My Returns</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2 pr-2">Return #</th><th className="py-2 pr-2">LR No</th><th className="py-2 pr-2">Fin Year</th><th className="py-2 pr-2">Lead</th><th className="py-2 pr-2">Return Date</th><th className="py-2 pr-2">Remarks</th><th className="py-2 pr-2">Created</th></tr></thead>
            <tbody>
              {myReturns.map((r) => (
                <tr key={r._id} className="border-b">
                  <td className="py-2 pr-2">{r.returnNumber}</td>
                  <td className="py-2 pr-2">{r.lrNumber || '-'}</td>
                  <td className="py-2 pr-2">{r.finYear || '-'}</td>
                  <td className="py-2 pr-2">{r.leadId?.school_name || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.returnDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-2">{r.remarks || '-'}</td>
                  <td className="py-2 pr-2">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {myReturns.length === 0 && (<tr><td className="py-3 text-muted-foreground" colSpan={7}>No returns yet</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}


