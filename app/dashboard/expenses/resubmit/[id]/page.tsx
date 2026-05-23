'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, LOCAL_API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

type ExpensePolicy = {
  skipFinanceStage: boolean
  foodBillMandatoryAbove: number
  requireTicketForModes: string[]
}

type ExpenseRecord = {
  _id: string
  status: string
  category: string
  amount: number
  date: string
  employeeRemarks?: string
  rejectionReason?: string
  receipt?: string
  ticketReceipt?: string
  transportType?: string
  travelFrom?: string
  travelTo?: string
  approxKms?: number
  gpsDistance?: number
  lodgeName?: string
  city?: string
  stayDate?: string
  restaurantName?: string
  mealDate?: string
  otherExpenseType?: string
  expenseName?: string
  description?: string
}

const OTHER_TYPES = ['Parking', 'Toll', 'Courier', 'Printing', 'Miscellaneous', 'Other'] as const

function normalizeCategory(cat: string): 'travel' | 'food' | 'accommodation' | 'other' {
  const c = (cat || '').toLowerCase()
  if (c === 'travel') return 'travel'
  if (c === 'food') return 'food'
  if (c === 'accommodation' || c === 'accomodation') return 'accommodation'
  return 'other'
}

function calcTravelAmount(mode: string, kms: number) {
  if (mode === 'Bike') return (kms * 2.8).toFixed(2)
  if (mode === 'Car') return (kms * 8).toFixed(2)
  return ''
}

function toDateInput(d?: string) {
  if (!d) return new Date().toISOString().split('T')[0]
  return new Date(d).toISOString().split('T')[0]
}

export default function ResubmitExpensePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [policy, setPolicy] = useState<ExpensePolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsNote, setGpsNote] = useState('')

  const [category, setCategory] = useState<'travel' | 'food' | 'accommodation' | 'other'>('travel')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [transportType, setTransportType] = useState('')
  const [travelFrom, setTravelFrom] = useState('')
  const [travelTo, setTravelTo] = useState('')
  const [approxKms, setApproxKms] = useState('')
  const [gpsDistance, setGpsDistance] = useState<number | null>(null)
  const [lodgeName, setLodgeName] = useState('')
  const [city, setCity] = useState('')
  const [stayDate, setStayDate] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [mealDate, setMealDate] = useState('')
  const [otherExpenseType, setOtherExpenseType] = useState<string>('Miscellaneous')
  const [expenseName, setExpenseName] = useState('')
  const [description, setDescription] = useState('')
  const [billFile, setBillFile] = useState<File | null>(null)
  const [ticketFile, setTicketFile] = useState<File | null>(null)
  const [existingReceipt, setExistingReceipt] = useState('')
  const [existingTicket, setExistingTicket] = useState('')
  const [managerNote, setManagerNote] = useState('')

  useEffect(() => {
    Promise.all([
      apiRequest<ExpensePolicy>('/expenses/policy').catch(() => ({
        skipFinanceStage: false,
        foodBillMandatoryAbove: 500,
        requireTicketForModes: ['Bus', 'Train', 'Flight', 'Other'],
      })),
      apiRequest<ExpenseRecord>(`/expenses/${id}`),
    ])
      .then(([pol, exp]) => {
        setPolicy(pol)
        if (exp.status !== 'Needs Correction') {
          toast.error('This expense is not awaiting correction')
          router.replace(`/dashboard/expenses/${id}`)
          return
        }
        const cat = normalizeCategory(exp.category)
        setCategory(cat)
        setDate(toDateInput(exp.date))
        setAmount(String(exp.amount))
        setRemarks(exp.employeeRemarks || '')
        setManagerNote(exp.rejectionReason || '')
        setExistingReceipt(exp.receipt || '')
        setExistingTicket(exp.ticketReceipt || '')
        if (cat === 'travel') {
          setTransportType(exp.transportType || '')
          setTravelFrom(exp.travelFrom || '')
          setTravelTo(exp.travelTo || '')
          setApproxKms(String(exp.approxKms ?? ''))
          setGpsDistance(exp.gpsDistance ?? null)
        }
        if (cat === 'accommodation') {
          setLodgeName(exp.lodgeName || '')
          setCity(exp.city || '')
          setStayDate(toDateInput(exp.stayDate))
        }
        if (cat === 'food') {
          setRestaurantName(exp.restaurantName || '')
          setMealDate(toDateInput(exp.mealDate))
        }
        if (cat === 'other') {
          setOtherExpenseType(exp.otherExpenseType || 'Miscellaneous')
          setExpenseName(exp.expenseName || '')
          setDescription(exp.description || '')
        }
      })
      .catch(() => toast.error('Could not load expense'))
      .finally(() => setLoading(false))
  }, [id, router])

  const ticketRequired = useMemo(() => {
    if (!policy || category !== 'travel') return false
    return (
      transportType === 'Other' || policy.requireTicketForModes.includes(transportType)
    )
  }, [policy, category, transportType])

  const billRequired = useMemo(() => {
    if (category === 'accommodation') return !existingReceipt
    const amt = parseFloat(amount) || 0
    if (category === 'food' && policy) return amt >= policy.foodBillMandatoryAbove && !existingReceipt
    if (category === 'other') {
      return (
        ['Parking', 'Toll', 'Courier', 'Printing'].includes(otherExpenseType) && !existingReceipt
      )
    }
    return false
  }, [category, amount, policy, otherExpenseType, existingReceipt])

  const fetchGpsDistance = async () => {
    if (!travelFrom.trim() || !travelTo.trim()) {
      toast.error('Enter From and To locations first')
      return
    }
    setGpsLoading(true)
    setGpsNote('')
    try {
      const res = await apiRequest<{ gpsDistance: number | null; error?: string }>(
        '/expenses/calculate-distance',
        {
          method: 'POST',
          body: JSON.stringify({ from: travelFrom, to: travelTo }),
        }
      )
      if (res.gpsDistance != null) {
        setGpsDistance(res.gpsDistance)
        setGpsNote(`System estimate: ${res.gpsDistance} km`)
      } else {
        setGpsNote(res.error || 'GPS distance unavailable')
      }
    } catch (e: unknown) {
      setGpsNote(e instanceof Error ? e.message : 'Could not calculate GPS distance')
    } finally {
      setGpsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (category === 'travel') {
      if (!transportType || !travelFrom || !travelTo || !approxKms) {
        toast.error('Complete all travel fields')
        return
      }
      if (ticketRequired && !ticketFile && !existingTicket) {
        toast.error('Ticket upload is required')
        return
      }
    }
    if (category === 'accommodation' && billRequired && !billFile) {
      toast.error('Bill upload is required')
      return
    }
    if (category === 'food' && billRequired && !billFile) {
      toast.error(`Bill required for food above ₹${policy?.foodBillMandatoryAbove ?? 500}`)
      return
    }
    if (category === 'other' && billRequired && !billFile) {
      toast.error('Proof upload is required')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('date', date)
      formData.append('amount', amount)
      formData.append('employeeRemarks', remarks)
      formData.append('title', `${category} expense`)

      if (category === 'travel') {
        formData.append('transportType', transportType)
        formData.append('travelFrom', travelFrom)
        formData.append('travelTo', travelTo)
        formData.append('approxKms', approxKms)
        if (gpsDistance != null) {
          formData.append('gpsDistance', String(gpsDistance))
          formData.append('gpsProvider', 'google')
        }
      }
      if (category === 'accommodation') {
        formData.append('lodgeName', lodgeName)
        formData.append('city', city)
        formData.append('stayDate', stayDate)
      }
      if (category === 'food') {
        formData.append('restaurantName', restaurantName)
        formData.append('mealDate', mealDate)
      }
      if (category === 'other') {
        formData.append('otherExpenseType', otherExpenseType)
        formData.append('expenseName', expenseName || otherExpenseType)
        formData.append('description', description)
      }
      if (billFile) formData.append('bill', billFile)
      if (ticketFile) formData.append('ticket', ticketFile)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const headers: HeadersInit = {}
      if (token) headers.Authorization = `Bearer ${token}`

      const base =
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || LOCAL_API_BASE_URL
      const res = await fetch(`${base}/api/expenses/${id}/resubmit`, {
        method: 'PUT',
        headers,
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Resubmit failed')
      }
      toast.success('Expense resubmitted for approval')
      router.push('/dashboard/expenses/my')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Resubmit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-neutral-500">Loading…</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Correct & resubmit expense</h1>
      </div>

      {managerNote && (
        <Card className="p-4 bg-orange-50 border-orange-200 text-sm text-orange-900">
          <p className="font-medium">Manager feedback</p>
          <p className="mt-1">{managerNote}</p>
        </Card>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Category</Label>
            <p className="mt-1 capitalize font-medium text-neutral-800">{category}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" className="bg-white mt-1" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                className="bg-white mt-1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {category === 'travel' && (
            <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50/50">
              <div>
                <Label>Travel mode *</Label>
                <Select value={transportType || undefined} onValueChange={(v) => {
                  setTransportType(v)
                  const amt = calcTravelAmount(v, parseFloat(approxKms) || 0)
                  if (amt) setAmount(amt)
                }}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue placeholder="Mode" /></SelectTrigger>
                  <SelectContent>
                    {['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Other'].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>From *</Label>
                  <Input className="bg-white mt-1" value={travelFrom} onChange={(e) => setTravelFrom(e.target.value)} />
                </div>
                <div>
                  <Label>To *</Label>
                  <Input className="bg-white mt-1" value={travelTo} onChange={(e) => setTravelTo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Distance claimed (km) *</Label>
                <Input
                  type="number"
                  className="bg-white mt-1"
                  value={approxKms}
                  onChange={(e) => {
                    setApproxKms(e.target.value)
                    if (transportType === 'Bike' || transportType === 'Car') {
                      const amt = calcTravelAmount(transportType, parseFloat(e.target.value) || 0)
                      if (amt) setAmount(amt)
                    }
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={fetchGpsDistance} disabled={gpsLoading}>
                {gpsLoading ? 'Calculating…' : 'Verify distance (GPS)'}
              </Button>
              {gpsNote && <p className="text-sm text-neutral-700">{gpsNote}</p>}
              {ticketRequired && (
                <div>
                  <Label>Ticket upload *</Label>
                  {existingTicket && (
                    <a href={resolveUploadUrl(existingTicket)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 block mb-1">
                      Current ticket on file
                    </a>
                  )}
                  <Input type="file" accept="image/*,.pdf" className="bg-white mt-1" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} />
                </div>
              )}
            </div>
          )}

          {category === 'accommodation' && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <Label>Lodge / hotel *</Label>
                <Input className="bg-white mt-1" value={lodgeName} onChange={(e) => setLodgeName(e.target.value)} />
              </div>
              <div>
                <Label>City *</Label>
                <Input className="bg-white mt-1" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <Label>Stay date *</Label>
                <Input type="date" className="bg-white mt-1" value={stayDate} onChange={(e) => setStayDate(e.target.value)} />
              </div>
              <div>
                <Label>Bill {billRequired ? '*' : ''}</Label>
                {existingReceipt && (
                  <a href={resolveUploadUrl(existingReceipt)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 block mb-1">
                    Current bill on file
                  </a>
                )}
                <Input type="file" accept="image/*,.pdf" className="bg-white mt-1" onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}

          {category === 'food' && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <Label>Restaurant *</Label>
                <Input className="bg-white mt-1" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
              </div>
              <div>
                <Label>Meal date *</Label>
                <Input type="date" className="bg-white mt-1" value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
              </div>
              <div>
                <Label>Bill {billRequired ? '*' : ''}</Label>
                {existingReceipt && (
                  <a href={resolveUploadUrl(existingReceipt)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 block mb-1">
                    Current bill on file
                  </a>
                )}
                <Input type="file" accept="image/*,.pdf" className="bg-white mt-1" onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}

          {category === 'other' && (
            <div className="space-y-3 p-4 border rounded-lg">
              <div>
                <Label>Type</Label>
                <Select value={otherExpenseType} onValueChange={setOtherExpenseType}>
                  <SelectTrigger className="bg-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OTHER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {otherExpenseType === 'Other' && (
                <div>
                  <Label>Name</Label>
                  <Input className="bg-white mt-1" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} />
                </div>
              )}
              <div>
                <Label>Description *</Label>
                <Textarea className="bg-white mt-1" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div>
                <Label>Proof {billRequired ? '*' : ''}</Label>
                {existingReceipt && (
                  <a href={resolveUploadUrl(existingReceipt)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 block mb-1">
                    Current proof on file
                  </a>
                )}
                <Input type="file" accept="image/*,.pdf" className="bg-white mt-1" onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          )}

          <div>
            <Label>Remarks</Label>
            <Textarea className="bg-white mt-1" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Resubmit for approval'}
          </Button>
        </form>
      </Card>

      <p className="text-sm text-neutral-500">
        <Link href={`/dashboard/expenses/${id}`} className="text-blue-600 underline">
          View read-only details
        </Link>
      </p>
    </div>
  )
}
