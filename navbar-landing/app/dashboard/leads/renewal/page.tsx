'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getCurrentUser } from '@/lib/auth'
import { useProducts } from '@/hooks/useProducts'
import { toast } from 'sonner'
import { ArrowLeft, MapPin, Edit, History, X, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type DcOrderSearchRow = {
  _id: string
  school_name?: string
  school_code?: string
  dc_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  location?: string
  city?: string
  state?: string
  region?: string
  area?: string
  pincode?: string
  strength?: number
  address?: string
  school_type?: string
  products?: Array<{ product_name?: string; quantity?: number; term?: string }>
  status?: string
}

type Lead = {
  _id: string
  lead_type?: string
  school_name?: string
  school_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  status?: string
  priority?: string
  follow_up_date?: string
  location?: string
  strength?: number
  createdAt?: string
  remarks?: string
  school_id?: string | DcOrderSearchRow
  products?: Array<{
    product_name?: string
    product?: string
    term?: string
    status?: string
    strength?: number
    chance?: number
    quantity?: number
  }> | string
}

type ProductInterested = {
  product_name: string
  term: string
  status: string
  strength: number
  chance: number
}

type ProductLine = {
  product_name: string
  quantity: number
  term: string
}

export default function RenewalLeadsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProductNames } = useProducts()
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<string[]>([])
  const [timeoutError, setTimeoutError] = useState(false)

  const [zone, setZone] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    status: '',
    remarks: '',
    productsInterested: [] as ProductInterested[],
  })
  const [updating, setUpdating] = useState(false)

  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyLead, setHistoryLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<any[]>([])

  // Create renewal — school search
  const [schoolQuery, setSchoolQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DcOrderSearchRow[]>([])
  const [selectedSchool, setSelectedSchool] = useState<DcOrderSearchRow | null>(null)
  const [schoolDetailLoading, setSchoolDetailLoading] = useState(false)
  const [renewContactPerson, setRenewContactPerson] = useState('')
  const [renewContactMobile, setRenewContactMobile] = useState('')
  const [renewRemarks, setRenewRemarks] = useState('')
  const [renewProducts, setRenewProducts] = useState<ProductLine[]>([
    { product_name: '', quantity: 1, term: 'Term 1' },
  ])
  const [creatingRenewal, setCreatingRenewal] = useState(false)

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allLeads, zone, schoolName, contactMobile])

  const loadLeads = async () => {
    setLoading(true)
    setTimeoutError(false)
    const timeoutId = setTimeout(() => {
      setTimeoutError(true)
      setLoading(false)
      toast.error('Loading is taking longer than expected.')
    }, 12000)

    try {
      if (!currentUser?._id) {
        toast.error('User not found')
        clearTimeout(timeoutId)
        return
      }

      const leadsResponse = await apiRequest<any>(
        `/leads?employee=${currentUser._id}&lead_type=renewal&limit=500`
      ).catch(() => ({ data: [] }))

      const allData = Array.isArray(leadsResponse) ? leadsResponse : leadsResponse?.data || []
      const active = (allData as Lead[]).filter((lead) => {
        const s = lead.status
        return s !== 'Closed' && s !== 'Saved'
      })

      setAllLeads(active)
      const uniqueZones = Array.from(new Set(active.map((l) => l.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
      clearTimeout(timeoutId)
    } catch (err: any) {
      clearTimeout(timeoutId)
      toast.error('Failed to load renewal leads')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allLeads]
    if (zone && zone !== 'all') filtered = filtered.filter((l) => l.zone?.toLowerCase().includes(zone.toLowerCase()))
    if (contactMobile) filtered = filtered.filter((l) => l.contact_mobile?.includes(contactMobile))
    if (schoolName) filtered = filtered.filter((l) => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()))
    filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })
    setLeads(filtered)
  }

  const runSchoolSearch = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await apiRequest<{ data: DcOrderSearchRow[] }>(
        `/dc-orders/renewal-search?q=${encodeURIComponent(t)}&limit=25`
      )
      setSearchResults(Array.isArray(res?.data) ? res.data : [])
    } catch {
      toast.error('School search failed')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runSchoolSearch(schoolQuery), 350)
    return () => clearTimeout(t)
  }, [schoolQuery, runSchoolSearch])

  const displayField = (v?: string | number | null) => {
    if (v === undefined || v === null) return '—'
    const s = String(v).trim()
    return s || '—'
  }

  const mergeDcOrderIntoRow = (row: DcOrderSearchRow, full: Record<string, unknown>): DcOrderSearchRow => ({
    _id: row._id,
    school_name: (full.school_name as string) ?? row.school_name,
    school_code: (full.school_code as string) ?? row.school_code,
    dc_code: (full.dc_code as string) ?? row.dc_code,
    contact_person: (full.contact_person as string) ?? row.contact_person,
    contact_mobile: (full.contact_mobile as string) ?? row.contact_mobile,
    zone: (full.zone as string) ?? row.zone,
    location: (full.location as string) ?? row.location,
    city: (full.city as string) ?? row.city,
    state: (full.state as string) ?? row.state,
    region: (full.region as string) ?? row.region,
    area: (full.area as string) ?? row.area,
    pincode: (full.pincode as string) ?? row.pincode,
    strength: (full.strength as number) ?? row.strength,
    address: (full.address as string) ?? row.address,
    school_type: (full.school_type as string) ?? row.school_type,
    products: Array.isArray(full.products) ? (full.products as DcOrderSearchRow['products']) : row.products,
    status: (full.status as string) ?? row.status,
  })

  const selectSchool = async (row: DcOrderSearchRow) => {
    setSearchResults([])
    setSchoolQuery(row.school_name || '')
    setSelectedSchool(row)
    setRenewContactPerson(row.contact_person || '')
    setRenewContactMobile(row.contact_mobile || '')
    setSchoolDetailLoading(true)
    try {
      const full = await apiRequest<Record<string, unknown>>(`/dc-orders/${row._id}`)
      if (full && typeof full === 'object' && (full as { _id?: string })._id) {
        const merged = mergeDcOrderIntoRow(row, full)
        setSelectedSchool(merged)
        setRenewContactPerson(
          String((full as { contact_person?: string }).contact_person || '').trim() ||
            row.contact_person ||
            ''
        )
        setRenewContactMobile(
          String((full as { contact_mobile?: string }).contact_mobile || '').trim() ||
            row.contact_mobile ||
            ''
        )
      }
    } catch {
      toast.error('Could not load full school record; showing search summary.')
    } finally {
      setSchoolDetailLoading(false)
    }
  }

  const schoolDisplayCode = (row: DcOrderSearchRow | null) => {
    if (!row) return '-'
    return (row.school_code || row.dc_code || '').trim() || '-'
  }

  const addRenewProduct = () => {
    setRenewProducts((p) => [...p, { product_name: '', quantity: 1, term: 'Term 1' }])
  }

  const removeRenewProduct = (i: number) => {
    setRenewProducts((p) => p.filter((_, idx) => idx !== i))
  }

  const updateRenewProduct = (i: number, field: keyof ProductLine, value: string | number) => {
    setRenewProducts((p) =>
      p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    )
  }

  const submitRenewalLead = async () => {
    if (!selectedSchool?._id) {
      toast.error('Select an existing school from search')
      return
    }
    if (!renewContactPerson.trim() || !renewContactMobile.trim()) {
      toast.error('Contact person and mobile are required')
      return
    }
    const products = renewProducts
      .filter((r) => r.product_name.trim())
      .map((r) => ({
        product_name: r.product_name.trim(),
        quantity: Math.max(1, Number(r.quantity) || 1),
        term: r.term,
        unit_price: 0,
      }))
    if (products.length === 0) {
      toast.error('Add at least one product')
      return
    }
    setCreatingRenewal(true)
    try {
      await apiRequest('/leads/create', {
        method: 'POST',
        body: JSON.stringify({
          lead_type: 'renewal',
          school_id: selectedSchool._id,
          contact_person: renewContactPerson.trim(),
          contact_mobile: renewContactMobile.trim(),
          remarks: renewRemarks,
          products,
        }),
      })
      toast.success('Renewal lead created')
      setSelectedSchool(null)
      setSchoolQuery('')
      setRenewRemarks('')
      setRenewProducts([{ product_name: '', quantity: 1, term: 'Term 1' }])
      await loadLeads()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create renewal lead')
    } finally {
      setCreatingRenewal(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '-'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-orange-100 text-orange-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const leadSchoolCode = (lead: Lead) => {
    if (lead.school_code) return lead.school_code
    const sid = lead.school_id
    if (sid && typeof sid === 'object') {
      return (sid.school_code || sid.dc_code || '').trim() || '-'
    }
    return '-'
  }

  const openUpdateModal = (lead: Lead) => {
    setSelectedLead(lead)
    setUpdateForm({
      follow_up_date: '',
      status: lead.priority || 'Hot',
      remarks: '',
      productsInterested: (() => {
        if (Array.isArray(lead.products) && lead.products.length > 0) {
          return lead.products.map((p: any) => ({
            product_name: p.product_name || p.product || '',
            term: p.term || 'Term 1',
            status: p.status || lead.priority || 'Warm',
            strength: Number(p.strength ?? p.quantity ?? 0) || 0,
            chance: Number(p.chance ?? 0) || 0,
          }))
        }
        return []
      })(),
    })
    setUpdateModalOpen(true)
  }

  const closeUpdateModal = () => {
    setUpdateModalOpen(false)
    setSelectedLead(null)
    setUpdateForm({ follow_up_date: '', status: '', remarks: '', productsInterested: [] })
  }

  const handleUpdateLead = async () => {
    if (!selectedLead) return
    if (!updateForm.follow_up_date?.trim()) {
      toast.error('Next Follow-up Date is required')
      return
    }
    if (!updateForm.status?.trim()) {
      toast.error('Lead Priority is required')
      return
    }
    if (!updateForm.remarks?.trim()) {
      toast.error('Remarks is required')
      return
    }
    setUpdating(true)
    try {
      const payload: any = {
        follow_up_date: new Date(updateForm.follow_up_date).toISOString(),
        priority: updateForm.status,
        remarks: updateForm.remarks,
      }
      const validProducts = updateForm.productsInterested
        .filter((p) => p.product_name?.trim())
        .map((p) => ({
          product_name: p.product_name.trim(),
          term: p.term || 'Term 1',
          status: p.status || 'Warm',
          strength: Number(p.strength) || 0,
          chance: Number(p.chance) || 0,
          quantity: Number(p.strength) || 0,
          unit_price: 0,
        }))
      if (validProducts.length > 0) payload.productsInterested = validProducts

      await apiRequest(`/leads/${selectedLead._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      toast.success('Follow-up saved')
      closeUpdateModal()
      await loadLeads()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const openHistoryModal = async (lead: Lead) => {
    setHistoryLead(lead)
    setHistoryModalOpen(true)
    setHistory([])
    try {
      const full = await apiRequest<any>(`/leads/${lead._id}`)
      let historyData: any[] = Array.isArray(full?.updateHistory) ? [...full.updateHistory] : []
      if (historyData.length === 0 && lead.createdAt) {
        historyData = [
          {
            follow_up_date: lead.follow_up_date || null,
            remarks: lead.remarks || 'Renewal lead created',
            priority: lead.priority || 'Warm',
            updatedAt: lead.createdAt,
            updatedBy: { name: 'System' },
          },
        ]
      }
      historyData.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      )
      setHistory(historyData)
    } catch {
      toast.error('Could not load history')
    }
  }

  const closeHistoryModal = () => {
    setHistoryModalOpen(false)
    setHistoryLead(null)
    setHistory([])
  }

  const addInterestedProduct = () => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: [
        ...prev.productsInterested,
        { product_name: '', term: 'Term 1', status: 'Warm', strength: 0, chance: 0 },
      ],
    }))
  }

  const removeInterestedProduct = (index: number) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.filter((_, i) => i !== index),
    }))
  }

  const updateInterestedProduct = (index: number, field: keyof ProductInterested, value: string | number) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  const pastProductsPreview = useMemo(() => {
    if (!selectedSchool?.products?.length) return null
    return selectedSchool.products.slice(0, 5)
  }, [selectedSchool])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/leads/add">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Renewal Leads</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Existing schools only — search, minimal input, same pipeline as follow-ups
            </p>
          </div>
        </div>
        <Link href="/dashboard/leads/add">
          <Button variant="outline" size="sm">
            New school? Use Add Lead
          </Button>
        </Link>
      </div>

      <Card className="p-4 border-emerald-200 bg-emerald-50/40">
        <h2 className="text-lg font-semibold text-emerald-900 mb-3">Create renewal lead</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <Label>Search school (name or code)</Label>
              <Input
                placeholder="Type at least 2 characters…"
                value={schoolQuery}
                onChange={(e) => {
                  setSchoolQuery(e.target.value)
                  if (!e.target.value) setSelectedSchool(null)
                }}
              />
              {searchLoading && <p className="text-xs text-neutral-500 mt-1">Searching…</p>}
              {!selectedSchool && searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md bg-white shadow-sm">
                  {searchResults.map((r) => (
                    <button
                      key={r._id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 border-b last:border-0"
                      onClick={() => selectSchool(r)}
                    >
                      <div className="font-medium text-neutral-900">{r.school_name}</div>
                      <div className="text-xs text-neutral-600">
                        Code: {schoolDisplayCode(r)} · {r.zone || '—'} · {r.contact_mobile || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSchool && (
              <div className="rounded-md border bg-white p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-emerald-800">Selected school</div>
                  {schoolDetailLoading && (
                    <span className="text-xs text-neutral-500">Loading full record…</span>
                  )}
                </div>
                <div>
                  <span className="text-neutral-500">Name:</span>{' '}
                  <span className="font-medium">{selectedSchool.school_name}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Code:</span>{' '}
                  <span className="font-mono text-blue-700">{schoolDisplayCode(selectedSchool)}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Zone:</span> {displayField(selectedSchool.zone)}
                </div>
                <div>
                  <span className="text-neutral-500">Address:</span>{' '}
                  <span className="whitespace-pre-wrap">{displayField(selectedSchool.address)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <span className="text-neutral-500">Pincode:</span>{' '}
                    {displayField(selectedSchool.pincode)}
                  </div>
                  <div>
                    <span className="text-neutral-500">City:</span> {displayField(selectedSchool.city)}
                  </div>
                  <div>
                    <span className="text-neutral-500">State:</span> {displayField(selectedSchool.state)}
                  </div>
                  <div>
                    <span className="text-neutral-500">Region:</span> {displayField(selectedSchool.region)}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-neutral-500">Area:</span> {displayField(selectedSchool.area)}
                  </div>
                </div>
                <div>
                  <span className="text-neutral-500">Location:</span> {displayField(selectedSchool.location)}
                </div>
                {pastProductsPreview && pastProductsPreview.length > 0 && (
                  <div>
                    <span className="text-neutral-500">Recent products on file:</span>
                    <ul className="list-disc ml-4 mt-1 text-xs text-neutral-700">
                      {pastProductsPreview.map((p, i) => (
                        <li key={i}>
                          {p.product_name} × {p.quantity ?? '—'} ({p.term || 'Term 1'})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Contact person (editable)</Label>
                <Input
                  value={renewContactPerson}
                  onChange={(e) => setRenewContactPerson(e.target.value)}
                  disabled={!selectedSchool}
                />
              </div>
              <div>
                <Label>Mobile (editable)</Label>
                <Input
                  value={renewContactMobile}
                  onChange={(e) => setRenewContactMobile(e.target.value)}
                  disabled={!selectedSchool}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Products interested</Label>
                <Button type="button" size="sm" variant="outline" onClick={addRenewProduct} disabled={!selectedSchool}>
                  Add line
                </Button>
              </div>
              <div className="space-y-2">
                {renewProducts.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[140px]">
                      <Select
                        value={row.product_name || undefined}
                        onValueChange={(v) => updateRenewProduct(i, 'product_name', v)}
                        disabled={!selectedSchool}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProductNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={row.quantity}
                      onChange={(e) => updateRenewProduct(i, 'quantity', Number(e.target.value) || 1)}
                      disabled={!selectedSchool}
                    />
                    <Select
                      value={row.term}
                      onValueChange={(v) => updateRenewProduct(i, 'term', v)}
                      disabled={!selectedSchool}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRenewProduct(i)}
                      disabled={!selectedSchool || renewProducts.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={renewRemarks}
                onChange={(e) => setRenewRemarks(e.target.value)}
                rows={3}
                disabled={!selectedSchool}
                placeholder="Optional context for this renewal…"
              />
            </div>

            <Button
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              disabled={!selectedSchool || creatingRenewal}
              onClick={submitRenewalLead}
            >
              {creatingRenewal ? 'Saving…' : 'Submit renewal lead'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Zone</label>
            <Select value={zone || undefined} onValueChange={(v) => setZone(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones
                  .filter((z) => z && z.trim() !== '')
                  .map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input placeholder="Filter…" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Contact Mobile</label>
            <Input placeholder="Filter…" value={contactMobile} onChange={(e) => setContactMobile(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={loadLeads} className="w-full">
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading renewal leads…</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {allLeads.length === 0
              ? 'No active renewal leads. Create one above or check Closed in reports.'
              : 'No leads match filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {timeoutError && (
              <Card className="p-6 bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="text-sm text-yellow-800">Request timed out. Try Refresh.</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => loadLeads()}>
                      Retry
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {leads.map((lead) => (
              <Card key={lead._id} className="p-5 border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-bold text-emerald-700">{lead.school_name || 'School'}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                          Renewal
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">Code: {leadSchoolCode(lead)}</span>
                      </div>
                      {lead.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-600">
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <span>{lead.location}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600"
                      onClick={() => router.push(`/dashboard/leads/close/${lead._id}`)}
                    >
                      Close Lead
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-600">Contact:</span>
                      <span className="ml-2 font-medium">{lead.contact_person || '—'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Mobile:</span>
                      <span className="ml-2 font-medium">{lead.contact_mobile || '—'}</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {lead.remarks && (
                      <div>
                        <span className="text-neutral-600">Remarks:</span>
                        <span className="ml-2">{lead.remarks}</span>
                      </div>
                    )}
                    {lead.follow_up_date && (
                      <div>
                        <span className="text-neutral-600">Follow up:</span>
                        <span
                          className={`ml-2 font-medium ${
                            new Date(lead.follow_up_date) < new Date() ? 'text-red-600' : ''
                          }`}
                        >
                          {formatDateTime(lead.follow_up_date)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-600">Priority:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPriorityColor(lead.priority)}`}>
                        {lead.priority || 'Warm'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Status:</span>
                      <span className="ml-2 font-medium">{lead.status || '—'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-50 text-amber-800 border-amber-200"
                      onClick={() => router.push(`/dashboard/leads/edit/${lead._id}`)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-purple-50 text-purple-700 border-purple-200"
                      onClick={() => openUpdateModal(lead)}
                    >
                      Create Follow-up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                      onClick={() => openHistoryModal(lead)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      View History
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create follow-up</DialogTitle>
            <DialogDescription>Log interaction for this renewal lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Follow-up date *</Label>
              <Input
                type="date"
                value={updateForm.follow_up_date}
                onChange={(e) => setUpdateForm({ ...updateForm, follow_up_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Priority *</Label>
              <Select value={updateForm.status} onValueChange={(v) => setUpdateForm({ ...updateForm, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hot">Hot</SelectItem>
                  <SelectItem value="Warm">Warm</SelectItem>
                  <SelectItem value="Cold">Cold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <Label>Products interested</Label>
                <Button type="button" size="sm" variant="outline" onClick={addInterestedProduct}>
                  Add
                </Button>
              </div>
              <div className="space-y-2 border rounded-md p-2">
                {updateForm.productsInterested.map((product, index) => (
                  <div key={index} className="flex flex-wrap gap-2 items-center">
                    <Select
                      value={product.product_name || undefined}
                      onValueChange={(v) => updateInterestedProduct(index, 'product_name', v)}
                    >
                      <SelectTrigger className="flex-1 min-w-[120px]">
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProductNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={product.term}
                      onValueChange={(v) => updateInterestedProduct(index, 'term', v)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-20"
                      value={product.strength}
                      onChange={(e) =>
                        updateInterestedProduct(index, 'strength', Number(e.target.value) || 0)
                      }
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeInterestedProduct(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Remarks *</Label>
              <Textarea
                value={updateForm.remarks}
                onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUpdateModal}>
              Cancel
            </Button>
            <Button onClick={handleUpdateLead} disabled={updating}>
              {updating ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update history</DialogTitle>
            <DialogDescription>{historyLead?.school_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {history.length === 0 ? (
              <p className="text-sm text-neutral-500">No history entries.</p>
            ) : (
              history.map((h, i) => (
                <Card key={i} className="p-3 text-sm">
                  <div className="text-xs text-neutral-500">{formatDateTime(h.updatedAt)}</div>
                  {h.priority && <div>Priority: {h.priority}</div>}
                  {h.remarks && <div className="mt-1">{h.remarks}</div>}
                  {h.follow_up_date && <div className="mt-1">Next: {formatDate(h.follow_up_date)}</div>}
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeHistoryModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
