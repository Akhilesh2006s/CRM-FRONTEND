'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

export type TicketsView = 'all' | 'solved' | 'pending'

type Person = { name?: string; role?: string; designation?: string; trainerProducts?: string[] }
type Ticket = {
  _id: string
  raisedBy?: Person | string | null
  subject: string
  description: string
  schoolName?: string
  schoolCode?: string
  town?: string
  status: 'Open' | 'Resolved'
  resolutionNote?: string
  assignedTo?: Person | null
  createdAt: string
}
type Assignee = { _id: string; name?: string; role?: string }

/** Roles that see every ticket and can assign them (others see only tickets assigned to them). */
const REVIEW_ROLES = new Set(['Coordinator', 'Senior Coordinator', 'Admin', 'Super Admin'])

const VIEWS: { view: TicketsView; label: string; href: string; status?: Ticket['status'] }[] = [
  { view: 'all', label: 'All Tickets', href: '/dashboard/complaints' },
  { view: 'solved', label: 'Solved Tickets', href: '/dashboard/complaints/solved', status: 'Resolved' },
  { view: 'pending', label: 'Pending Tickets', href: '/dashboard/complaints/pending', status: 'Open' },
]

/** Stored ticket status → the label used everywhere in the app. */
export function ticketStatusLabel(status: Ticket['status']) {
  return status === 'Resolved' ? 'Solved' : 'Pending'
}

const BDE_ROLES = new Set(['Executive', 'Sales BDE', 'Employee', 'BDE'])

function personName(value?: Person | string | null) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return value.name || '—'
}

/** The raiser's own designation (e.g. "Abacus Trainer"); falls back to their role. */
function personDesignation(value?: Person | string | null) {
  if (!value || typeof value === 'string') return '—'
  const designation = String(value.designation || '').trim()
  if (designation) return designation
  const role = String(value.role || '').trim()
  if (role === 'Trainer' && value.trainerProducts?.length) return `${value.trainerProducts.join(' / ')} Trainer`
  return BDE_ROLES.has(role) ? 'BDE' : role || '—'
}

export function TicketsInbox({ view }: { view: TicketsView }) {
  const current = VIEWS.find((item) => item.view === view) || VIEWS[0]
  const [items, setItems] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [isReviewer, setIsReviewer] = useState(false)
  const [assignId, setAssignId] = useState<string | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [assigneeId, setAssigneeId] = useState('')

  useEffect(() => {
    const u: any = getCurrentUser()
    setIsReviewer(Boolean(u?.isSuperAdmin) || REVIEW_ROLES.has(String(u?.role || '')))
  }, [])

  const openAssign = async (id: string) => {
    setAssignId(id)
    setAssigneeId('')
    if (assignees.length) return
    try {
      const data = await apiRequest<Assignee[]>('/complaints/assignees')
      setAssignees(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load people to assign')
    }
  }

  const confirmAssign = async () => {
    if (!assignId || !assigneeId) return
    setActing(true)
    try {
      await apiRequest(`/complaints/${assignId}/assign`, { method: 'PUT', body: JSON.stringify({ userId: assigneeId }) })
      toast.success('Ticket assigned')
      setAssignId(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign ticket')
    } finally {
      setActing(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Ticket[]>(`/complaints${current.status ? `?status=${current.status}` : ''}`)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tickets')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [current.status])

  useEffect(() => {
    load()
  }, [load])

  const confirmResolve = async () => {
    if (!resolveId) return
    if (!resolutionNote.trim()) {
      toast.error('Enter a remark before marking the ticket as solved.')
      return
    }
    setActing(true)
    try {
      await apiRequest(`/complaints/${resolveId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ resolutionNote }),
      })
      toast.success('Ticket marked solved')
      setResolveId(null)
      setResolutionNote('')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to solve ticket')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">View Tickets</h1>
        <p className="text-sm text-neutral-600 mt-1">
          {isReviewer ? 'Tickets raised by employees of every designation, oldest first.' : 'Tickets assigned to you, oldest first.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ticket sections">
        {VIEWS.map((item) => (
          <Link key={item.view} href={item.href} role="tab" aria-selected={item.view === view}>
            <Button variant={item.view === view ? 'default' : 'outline'} size="sm">{item.label}</Button>
          </Link>
        ))}
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Raised by</th>
                <th className="py-2 px-3 text-left">Designation</th>
                <th className="py-2 px-3 text-left">Subject</th>
                <th className="py-2 px-3 text-left">School</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Raised</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 px-3 text-center text-neutral-500">
                    No {current.label.toLowerCase()}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b last:border-0 align-top">
                    <td className="py-2 px-3">{personName(item.raisedBy)}</td>
                    <td className="py-2 px-3">{personDesignation(item.raisedBy)}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{item.subject}</div>
                      <div className="text-neutral-600">{item.description}</div>
                      {item.resolutionNote ? (
                        <div className="text-xs text-neutral-500 mt-1">Note: {item.resolutionNote}</div>
                      ) : null}
                    </td>
                    <td className="py-2 px-3">
                      {item.schoolName || '—'}
                      {item.schoolCode ? ` (${item.schoolCode})` : ''}
                      {item.town ? <div className="text-xs text-neutral-500">{item.town}</div> : null}
                    </td>
                    <td className="py-2 px-3">
                      <span className={item.status === 'Resolved' ? 'text-green-700' : 'text-amber-700'}>
                        {ticketStatusLabel(item.status)}
                      </span>
                      {item.assignedTo && typeof item.assignedTo === 'object' ? (
                        <div className="text-xs text-neutral-500 mt-1">
                          Assigned to {item.assignedTo.name}{item.assignedTo.role ? ` (${item.assignedTo.role})` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 px-3">{new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="py-2 px-3 text-right">
                      {item.status === 'Open' ? (
                        <div className="flex justify-end gap-2">
                        {isReviewer ? (
                          <Button size="sm" variant="outline" disabled={acting} onClick={() => openAssign(item._id)}>
                            Assign
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={acting}
                          onClick={() => {
                            setResolveId(item._id)
                            setResolutionNote('')
                          }}
                        >
                          Mark solved
                        </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={Boolean(assignId)} onOpenChange={(open) => !open && setAssignId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Super Admin, Admin, Finance Manager or HR Manager" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name || 'Unnamed'} ({a.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignId(null)}>
              Cancel
            </Button>
            <Button disabled={acting || !assigneeId} onClick={confirmAssign}>
              {acting ? 'Saving…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resolveId)} onOpenChange={(open) => !open && setResolveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark ticket solved</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Remark *</Label>
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              placeholder="What was done to solve this ticket (required)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>
              Cancel
            </Button>
            <Button disabled={acting || !resolutionNote.trim()} onClick={confirmResolve}>
              {acting ? 'Saving…' : 'Mark solved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
