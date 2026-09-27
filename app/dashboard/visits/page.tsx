'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  CalendarClock,
  Crosshair,
  GraduationCap,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'

type Visit = {
  _id: string
  schoolName?: string
  schoolCode?: string
  contactMobile?: string
  zone?: string
  town?: string
  visitDate?: string
  category?: string
  outcome?: string
  remarks?: string
  latitude?: number
  longitude?: number
  nextVisitDate?: string
  trainingDate?: string
  products?: string[]
  executiveId?: { _id: string; name?: string; email?: string }
  operations?: {
    deliveryStatus?: string
    booksDistributed?: string
    programsStarted?: string
    programsStartedDate?: string
    pagesCompleted?: { program: string; pages: number }[]
  }
}

type PageRow = { program: string; pages: string }

type ClientProgram = {
  id: string
  schoolName: string
  schoolCode: string
  dcOrderId?: string
  programs: string[]
}

const OPERATIONS = 'OPERATIONS'

function programNamesFromClient(dc: any): string[] {
  const names = new Set<string>()
  const order = dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null
  for (const row of dc?.productDetails || []) {
    const name = String(row?.product || row?.product_name || '').trim()
    if (name) names.add(name)
  }
  for (const row of order?.products || []) {
    const name = String(row?.product_name || row?.product || '').trim()
    if (name) names.add(name)
  }
  return [...names]
}

function clientsFromMyDcs(rows: any[]): ClientProgram[] {
  const bySchool = new Map<string, ClientProgram>()
  for (const dc of Array.isArray(rows) ? rows : []) {
    const order = dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null
    const schoolName = String(order?.school_name || dc?.customerName || dc?.school_name || '').trim()
    if (!schoolName) continue
    const key = schoolName.toLowerCase()
    const programs = programNamesFromClient(dc)
    const existing = bySchool.get(key)
    if (existing) {
      existing.programs = [...new Set([...existing.programs, ...programs])]
      if (!existing.dcOrderId && order?._id) existing.dcOrderId = String(order._id)
      continue
    }
    bySchool.set(key, {
      id: String(order?._id || dc?._id || schoolName),
      schoolName,
      schoolCode: String(order?.school_code || dc?.school_code || '').trim(),
      dcOrderId: order?._id ? String(order._id) : undefined,
      programs,
    })
  }
  return [...bySchool.values()].sort((a, b) => a.schoolName.localeCompare(b.schoolName))
}

type Employee = { _id: string; name?: string }

const OUTCOME_STYLES: Record<string, string> = {
  Hot: 'bg-red-100 text-red-700 border-red-200',
  Warm: 'bg-amber-100 text-amber-700 border-amber-200',
  Cold: 'bg-slate-100 text-slate-600 border-slate-200',
  'Visit Again': 'bg-blue-100 text-blue-700 border-blue-200',
  'Not Met Management': 'bg-purple-100 text-purple-700 border-purple-200',
  'Not Interested': 'bg-neutral-100 text-neutral-500 border-neutral-200',
}

const fmtDate = (value?: string) => {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

function operationsSummary(ops?: Visit['operations']) {
  if (!ops) return ''
  const pages = (ops.pagesCompleted || []).map((row) => `${row.program}: ${row.pages}`).join(', ')
  const started =
    ops.programsStarted === 'Yes'
      ? `Started ${fmtDate(ops.programsStartedDate)}`
      : ops.programsStarted
        ? `Started: ${ops.programsStarted}`
        : ''
  return [`${ops.deliveryStatus || 'DELIVERED'}`, ops.booksDistributed ? `Books: ${ops.booksDistributed}` : '', started, pages]
    .filter(Boolean)
    .join(' · ')
}

const emptyForm = {
  schoolName: '',
  schoolCode: '',
  contactMobile: '',
  zone: '',
  town: '',
  category: '',
  outcome: '',
  remarks: '',
  nextVisitDate: '',
  trainingDate: '',
  latitude: '' as string | number,
  longitude: '' as string | number,
  clientId: '',
  dcOrderId: '',
  booksDistributed: '',
  programsStarted: '',
  programsStartedDate: '',
  pagesCompleted: [] as PageRow[],
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [outcomes, setOutcomes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [clients, setClients] = useState<ClientProgram[]>([])
  const [clientsLoaded, setClientsLoaded] = useState(false)

  // filters
  const [schoolName, setSchoolName] = useState('')
  const [executiveId, setExecutiveId] = useState('all')
  const [category, setCategory] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    if (schoolName.trim()) p.set('schoolName', schoolName.trim())
    if (executiveId !== 'all') p.set('executiveId', executiveId)
    if (category !== 'all') p.set('category', category)
    if (fromDate) p.set('fromDate', fromDate)
    if (toDate) p.set('toDate', toDate)
    const s = p.toString()
    return s ? `?${s}` : ''
  }, [schoolName, executiveId, category, fromDate, toDate])

  const loadVisits = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Visit[]>(`/visits${queryString}`)
      setVisits(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || 'Could not load visits')
      setVisits([])
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    loadVisits()
  }, [loadVisits])

  useEffect(() => {
    apiRequest<{ categories: string[]; outcomes: string[] }>('/visits/categories')
      .then((d) => {
        setCategories(d?.categories || [])
        setOutcomes(d?.outcomes || [])
      })
      .catch(() => {})
    apiRequest<Employee[]>('/employees')
      .then((d) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open || form.category !== OPERATIONS || clientsLoaded) return
    apiRequest<any[]>('/dc/employee/my?limit=500')
      .then((data) => {
        setClients(clientsFromMyDcs(Array.isArray(data) ? data : []))
        setClientsLoaded(true)
      })
      .catch(() => setClientsLoaded(true))
  }, [open, form.category, clientsLoaded])

  const applyClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    setForm((f) => {
      if (!client) return { ...f, clientId: '', dcOrderId: '' }
      const previous = new Map(f.pagesCompleted.map((row) => [row.program, row.pages]))
      const pagesCompleted =
        client.programs.length > 0
          ? client.programs.map((program) => ({ program, pages: previous.get(program) || '' }))
          : [{ program: '', pages: '' }]
      return {
        ...f,
        clientId: client.id,
        dcOrderId: client.dcOrderId || '',
        schoolName: client.schoolName,
        schoolCode: client.schoolCode || f.schoolCode,
        pagesCompleted,
      }
    })
  }

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast.error('Location is not available in this browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }))
        toast.success('Location captured')
      },
      () => toast.error('Could not get your location'),
    )
  }

  const submitVisit = async () => {
    if (!form.schoolName.trim()) return toast.error('School name is required')
    if (!form.category) return toast.error('Visit category is required')
    if (form.category === OPERATIONS) {
      if (form.booksDistributed !== 'Yes' && form.booksDistributed !== 'No') {
        return toast.error('Books distributed to students must be Yes or No')
      }
      if (form.programsStarted !== 'Yes' && form.programsStarted !== 'No') {
        return toast.error('Programs started must be Yes or No')
      }
      if (form.programsStarted === 'Yes' && !form.programsStartedDate) {
        return toast.error('Enter the date programs started')
      }
      const filled = form.pagesCompleted.filter((row) => row.program.trim() || row.pages.trim())
      if (filled.length === 0) return toast.error('Enter pages completed for at least one program')
      for (const row of filled) {
        if (!row.program.trim()) return toast.error('Each pages row needs a program name')
        if (!/^\d+$/.test(row.pages.trim())) {
          return toast.error(`Pages completed for ${row.program.trim()} must be a whole number`)
        }
      }
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim() || undefined,
        contactMobile: form.contactMobile.trim() || undefined,
        zone: form.zone.trim() || undefined,
        town: form.town.trim() || undefined,
        category: form.category,
        outcome: form.outcome || undefined,
        remarks: form.remarks.trim() || undefined,
        nextVisitDate: form.nextVisitDate || undefined,
        trainingDate: form.trainingDate || undefined,
        dcOrderId: form.dcOrderId || undefined,
      }
      if (form.category === OPERATIONS) {
        payload.operations = {
          deliveryStatus: 'DELIVERED',
          booksDistributed: form.booksDistributed,
          programsStarted: form.programsStarted,
          programsStartedDate: form.programsStarted === 'Yes' ? form.programsStartedDate : undefined,
          pagesCompleted: form.pagesCompleted
            .filter((row) => row.program.trim())
            .map((row) => ({ program: row.program.trim(), pages: Number(row.pages) })),
        }
      }
      if (form.latitude !== '' && form.longitude !== '') {
        payload.latitude = Number(form.latitude)
        payload.longitude = Number(form.longitude)
      }

      await apiRequest('/visits', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('Visit logged')
      setOpen(false)
      setForm({ ...emptyForm })
      loadVisits()
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the visit')
    } finally {
      setSaving(false)
    }
  }

  const withLocation = visits.filter((v) => typeof v.latitude === 'number').length
  const followUpsDue = visits.filter(
    (v) => v.nextVisitDate && new Date(v.nextVisitDate) <= new Date(),
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">School Visits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every field visit — GPS-stamped, linked to a school, scheduling the next step.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadVisits} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Log Visit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Log a school visit</DialogTitle>
                <DialogDescription>
                  Record who was visited, what came of it, and when to go back.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="v-school">School name *</Label>
                  <Input
                    id="v-school"
                    value={form.schoolName}
                    onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                    placeholder="e.g. Bhashyam High School"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-code">School code</Label>
                  <Input
                    id="v-code"
                    value={form.schoolCode}
                    onChange={(e) => setForm({ ...form, schoolCode: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-mobile">Contact mobile</Label>
                  <Input
                    id="v-mobile"
                    value={form.contactMobile}
                    onChange={(e) => setForm({ ...form, contactMobile: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-zone">Zone</Label>
                  <Input
                    id="v-zone"
                    value={form.zone}
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-town">Town / area</Label>
                  <Input
                    id="v-town"
                    value={form.town}
                    onChange={(e) => setForm({ ...form, town: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Visit category *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        category: v,
                        pagesCompleted:
                          v === OPERATIONS && f.pagesCompleted.length === 0
                            ? [{ program: '', pages: '' }]
                            : f.pagesCompleted,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select
                    value={form.outcome}
                    onValueChange={(v) => setForm({ ...form, outcome: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      {outcomes.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.category === OPERATIONS && (
                  <div className="sm:col-span-2 space-y-4 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-sm font-semibold">Operations</p>
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={form.clientId || 'none'} onValueChange={(v) => applyClient(v === 'none' ? '' : v)}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select a client to load programs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Type programs manually</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.schoolName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choosing a client fills the school and one pages row per program.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Delivery status</Label>
                        <Input value="DELIVERED" readOnly className="bg-neutral-100" />
                      </div>
                      <div className="space-y-2">
                        <Label>Books distributed to students *</Label>
                        <Select
                          value={form.booksDistributed}
                          onValueChange={(v) => setForm((f) => ({ ...f, booksDistributed: v }))}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Yes or No" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Programs started *</Label>
                        <Select
                          value={form.programsStarted}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              programsStarted: v,
                              programsStartedDate: v === 'Yes' ? f.programsStartedDate : '',
                            }))
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Yes or No" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {form.programsStarted === 'Yes' && (
                        <div className="space-y-2">
                          <Label>Programs started date *</Label>
                          <Input
                            type="date"
                            className="bg-white"
                            value={form.programsStartedDate}
                            onChange={(e) => setForm((f) => ({ ...f, programsStartedDate: e.target.value }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Pages completed (program wise) *</Label>
                      <div className="space-y-2">
                        {form.pagesCompleted.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                            <Input
                              className="bg-white"
                              placeholder="Program"
                              value={row.program}
                              onChange={(e) =>
                                setForm((f) => {
                                  const pagesCompleted = [...f.pagesCompleted]
                                  pagesCompleted[idx] = { ...pagesCompleted[idx], program: e.target.value }
                                  return { ...f, pagesCompleted }
                                })
                              }
                            />
                            <Input
                              className="bg-white"
                              inputMode="numeric"
                              placeholder="Pages"
                              value={row.pages}
                              onChange={(e) =>
                                setForm((f) => {
                                  const pagesCompleted = [...f.pagesCompleted]
                                  pagesCompleted[idx] = {
                                    ...pagesCompleted[idx],
                                    pages: e.target.value.replace(/\D/g, ''),
                                  }
                                  return { ...f, pagesCompleted }
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={form.pagesCompleted.length === 1}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  pagesCompleted: f.pagesCompleted.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            pagesCompleted: [...f.pagesCompleted, { program: '', pages: '' }],
                          }))
                        }
                      >
                        Add program
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="v-next">Next visit date</Label>
                  <Input
                    id="v-next"
                    type="date"
                    value={form.nextVisitDate}
                    onChange={(e) => setForm({ ...form, nextVisitDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-training">Training date (optional)</Label>
                  <Input
                    id="v-training"
                    type="date"
                    value={form.trainingDate}
                    onChange={(e) => setForm({ ...form, trainingDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="v-remarks">Remarks</Label>
                  <Textarea
                    id="v-remarks"
                    rows={3}
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    placeholder="What was discussed, who you met, next steps…"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>Location</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                      <Crosshair className="h-4 w-4 mr-2" />
                      Use my location
                    </Button>
                    <Input
                      className="w-36"
                      placeholder="Latitude"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                    <Input
                      className="w-36"
                      placeholder="Longitude"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={submitVisit} disabled={saving}>
                  {saving ? 'Saving…' : 'Save visit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-blue-50 p-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{visits.length}</div>
              <div className="text-xs text-muted-foreground">Visits in view</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-50 p-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{withLocation}</div>
              <div className="text-xs text-muted-foreground">GPS-stamped</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-amber-50 p-2">
              <CalendarClock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{followUpsDue}</div>
              <div className="text-xs text-muted-foreground">Follow-ups due</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by school name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <Select value={executiveId} onValueChange={setExecutiveId}>
            <SelectTrigger>
              <SelectValue placeholder="BDE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All BDEs</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name || 'Unnamed'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">School</th>
                <th className="px-4 py-3 text-left font-medium">BDE</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-left font-medium">Outcome</th>
                <th className="px-4 py-3 text-left font-medium">Visit date</th>
                <th className="px-4 py-3 text-left font-medium">Next visit</th>
                <th className="px-4 py-3 text-left font-medium">Remarks</th>
                <th className="px-4 py-3 text-left font-medium">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Loading visits…
                  </td>
                </tr>
              ) : visits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-3 font-medium">No visits yet</p>
                    <p className="text-sm text-muted-foreground">
                      Visits logged by reps in the field will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{v.schoolName || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {[v.schoolCode, v.town, v.zone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        {v.executiveId?.name || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{v.category || '—'}</div>
                      {v.category === OPERATIONS && operationsSummary(v.operations) ? (
                        <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                          {operationsSummary(v.operations)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {v.outcome ? (
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            OUTCOME_STYLES[v.outcome] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {v.outcome}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(v.visitDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(v.nextVisitDate)}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="line-clamp-2 text-muted-foreground">{v.remarks || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {typeof v.latitude === 'number' && typeof v.longitude === 'number' ? (
                        <a
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Map
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
