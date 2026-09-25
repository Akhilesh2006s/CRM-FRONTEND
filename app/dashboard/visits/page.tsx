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
                    onValueChange={(v) => setForm({ ...form, category: v })}
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
                    <td className="px-4 py-3">{v.category || '—'}</td>
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
