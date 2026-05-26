'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, LOCAL_API_BASE_URL } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import {
  calcTravelAmount,
  isPerKmTravelMode,
  isTravelAmountLocked,
  perKmRateLabel,
  resolveTravelPerKmRates,
  type TravelPerKmRates,
} from '@/lib/expenseTravelRates'

type ExpensePolicy = {
  skipFinanceStage: boolean
  foodBillMandatoryAbove: number
  requireTicketForModes: string[]
  bikeRatePerKm?: number
  carRatePerKm?: number
}

type CartLine = {
  id: string
  category: 'travel' | 'food' | 'accommodation' | 'other'
  date: string
  amount: string
  remarks: string
  transportType: string
  travelFrom: string
  travelTo: string
  approxKms: string
  travelDate: string
  gpsDistance: number | null
  lodgeName: string
  city: string
  stayDate: string
  stayDateEnd: string
  restaurantName: string
  mealDate: string
  otherExpenseType: string
  expenseName: string
  description: string
  billFile: File | null
  ticketFile: File | null
}

const OTHER_TYPES = ['Parking', 'Toll', 'Courier', 'Printing', 'Miscellaneous', 'Other'] as const
const TRAVEL_MODES = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'] as const

function emptyLine(category: CartLine['category'] = 'travel'): CartLine {
  const today = new Date().toISOString().split('T')[0]
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category,
    date: today,
    amount: category === 'other' ? '' : category === 'travel' ? '' : '',
    remarks: '',
    transportType: '',
    travelFrom: '',
    travelTo: '',
    approxKms: '',
    travelDate: today,
    gpsDistance: null,
    lodgeName: '',
    city: '',
    stayDate: today,
    stayDateEnd: today,
    restaurantName: '',
    mealDate: today,
    otherExpenseType: 'Miscellaneous',
    expenseName: '',
    description: '',
    billFile: null,
    ticketFile: null,
  }
}

async function submitOneExpense(line: CartLine, batchId: string, policy: ExpensePolicy) {
  const formData = new FormData()
  const payload: Record<string, string | number> = {
    category: line.category,
    date: line.date,
    amount: parseFloat(line.amount) || 0,
    employeeRemarks: line.remarks,
    submissionBatchId: batchId,
    title: `${line.category} expense`,
  }

  if (line.category === 'travel') {
    payload.transportType = line.transportType
    payload.travelFrom = line.travelFrom
    payload.travelTo = line.travelTo
    payload.approxKms = parseFloat(line.approxKms) || 0
    payload.travelDate = line.travelDate
    if (line.gpsDistance != null) {
      payload.gpsDistance = line.gpsDistance
      payload.gpsProvider = 'google'
    }
  }
  if (line.category === 'accommodation') {
    payload.lodgeName = line.lodgeName
    payload.city = line.city
    payload.stayDate = line.stayDate
    if (line.stayDateEnd) payload.stayDateEnd = line.stayDateEnd
  }
  if (line.category === 'food') {
    payload.restaurantName = line.restaurantName
    payload.mealDate = line.mealDate
  }
  if (line.category === 'other') {
    payload.otherExpenseType = line.otherExpenseType
    payload.expenseName = line.expenseName || line.otherExpenseType
    payload.description = line.description
  }

  Object.entries(payload).forEach(([k, v]) => formData.append(k, String(v)))
  if (line.billFile) formData.append('bill', line.billFile)
  if (line.ticketFile) formData.append('ticket', line.ticketFile)

  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  const headers: HeadersInit = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || LOCAL_API_BASE_URL
  const res = await fetch(`${base}/api/expenses/create`, { method: 'POST', headers, body: formData })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || 'Failed to submit expense')
  }
  return res.json()
}

export default function CreateExpensePage() {
  const router = useRouter()
  const [policy, setPolicy] = useState<ExpensePolicy | null>(null)
  const [draft, setDraft] = useState<CartLine>(emptyLine('travel'))
  const [cart, setCart] = useState<CartLine[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsNote, setGpsNote] = useState('')

  useEffect(() => {
    apiRequest<ExpensePolicy>('/expenses/policy')
      .then(setPolicy)
      .catch(() =>
        setPolicy({
          skipFinanceStage: false,
          foodBillMandatoryAbove: 500,
          requireTicketForModes: ['Bus', 'Train', 'Flight'],
          bikeRatePerKm: 2.8,
          carRatePerKm: 8,
        })
      )
  }, [])

  const travelRates: TravelPerKmRates = useMemo(
    () =>
      resolveTravelPerKmRates({
        bikeRatePerKm: policy?.bikeRatePerKm,
        carRatePerKm: policy?.carRatePerKm,
      }),
    [policy]
  )

  const ticketRequired = useMemo(() => {
    if (!policy || draft.category !== 'travel') return false
    return policy.requireTicketForModes.includes(draft.transportType)
  }, [draft, policy])

  const showGlobalBillUpload =
    draft.category === 'travel' && !ticketRequired

  const travelAmountLocked = isTravelAmountLocked(draft.category, draft.transportType)

  const billRequired = useMemo(() => {
    if (draft.category === 'accommodation') return true
    const amt = parseFloat(draft.amount) || 0
    if (draft.category === 'food' && policy) return amt >= policy.foodBillMandatoryAbove
    if (draft.category === 'other') {
      return ['Parking', 'Toll', 'Courier', 'Printing'].includes(draft.otherExpenseType)
    }
    return false
  }, [draft, policy])

  const totals = useMemo(() => {
    const t = { travel: 0, accommodation: 0, food: 0, other: 0, grandTotal: 0 }
    for (const line of cart) {
      const a = parseFloat(line.amount) || 0
      t[line.category] += a
      t.grandTotal += a
    }
    return t
  }, [cart])

  const fetchGpsDistance = async () => {
    if (!draft.travelFrom.trim() || !draft.travelTo.trim()) {
      toast.error('Enter From and To locations first')
      return
    }
    setGpsLoading(true)
    setGpsNote('')
    try {
      const res = await apiRequest<{
        gpsDistance: number | null
        error?: string
      }>('/expenses/calculate-distance', {
        method: 'POST',
        body: JSON.stringify({ from: draft.travelFrom, to: draft.travelTo }),
      })
      if (res.gpsDistance != null) {
        const kms = String(res.gpsDistance)
        setDraft((d) => {
          const amt = isPerKmTravelMode(d.transportType)
            ? calcTravelAmount(d.transportType, res.gpsDistance!, travelRates)
            : d.amount
          return {
            ...d,
            gpsDistance: res.gpsDistance,
            approxKms: kms,
            amount: amt || d.amount,
          }
        })
        setGpsNote(`System estimate: ${res.gpsDistance} km`)
      } else {
        setGpsNote(res.error || 'GPS distance unavailable — manager can verify manually.')
      }
    } catch (e: unknown) {
      setGpsNote(e instanceof Error ? e.message : 'Could not calculate GPS distance')
    } finally {
      setGpsLoading(false)
    }
  }

  const addToCart = () => {
    if (!draft.amount || parseFloat(draft.amount) <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (draft.category === 'travel') {
      if (!draft.transportType || !draft.travelFrom || !draft.travelTo || !draft.approxKms) {
        toast.error('Complete all travel fields including distance claimed')
        return
      }
      if (ticketRequired && !draft.ticketFile) {
        toast.error('Ticket/proof upload is required for this travel mode')
        return
      }
    }
    if (draft.category === 'accommodation') {
      if (!draft.lodgeName || !draft.city || !draft.stayDate || !draft.stayDateEnd) {
        toast.error('Lodge name, city, and stay period (from–to) are required')
        return
      }
      if (new Date(draft.stayDateEnd) < new Date(draft.stayDate)) {
        toast.error('Stay to date must be on or after stay from date')
        return
      }
      if (!draft.billFile) {
        toast.error('Bill upload is required for accommodation')
        return
      }
    }
    if (draft.category === 'food') {
      if (!draft.restaurantName || !draft.mealDate) {
        toast.error('Restaurant and meal date are required')
        return
      }
      if (billRequired && !draft.billFile) {
        toast.error(`Bill required for food expenses of ₹${policy?.foodBillMandatoryAbove ?? 500}+`)
        return
      }
    }
    if (draft.category === 'other') {
      if (!draft.description.trim()) {
        toast.error('Description is required')
        return
      }
      if (billRequired && !draft.billFile) {
        toast.error('Proof upload is required for this expense type')
        return
      }
    }

    setCart((c) => [...c, { ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }])
    setDraft(emptyLine(draft.category))
    toast.success('Added to submission list')
  }

  const submitAll = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one expense line before submitting')
      return
    }
    setSubmitting(true)
    const batchId = `batch-${Date.now()}`
    try {
      for (const line of cart) {
        await submitOneExpense(line, batchId, policy!)
      }
      toast.success(`${cart.length} expense(s) submitted for approval`)
      router.push('/dashboard/expenses/my')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Submit reimbursement</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Add one or more expense lines, then submit for manager approval.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Proof rules: accommodation always needs a bill; food above ₹
          {policy?.foodBillMandatoryAbove ?? 500} needs a bill; Bus/Train/Flight travel needs a ticket
          upload. Use GPS verify on travel to compare claimed distance with maps.
        </div>

        <div>
          <Label>Category *</Label>
          <Select
            value={draft.category}
            onValueChange={(v) => setDraft(emptyLine(v as CartLine['category']))}
          >
            <SelectTrigger className="bg-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="travel">Travel</SelectItem>
              <SelectItem value="accommodation">Accommodation</SelectItem>
              <SelectItem value="food">Food</SelectItem>
              <SelectItem value="other">Other expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              className="bg-white mt-1"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
          <div>
            <Label>Amount (₹) *</Label>
            <Input
              type="number"
              step="0.01"
              className={`mt-1 ${travelAmountLocked ? 'bg-neutral-100 cursor-not-allowed' : 'bg-white'}`}
              value={draft.amount}
              readOnly={travelAmountLocked}
              onChange={(e) => {
                if (travelAmountLocked) return
                setDraft({ ...draft, amount: e.target.value })
              }}
              title={
                travelAmountLocked
                  ? 'Amount is calculated from distance and cannot be edited for Bike/Car'
                  : undefined
              }
            />
            {travelAmountLocked && (
              <p className="text-xs text-blue-700 mt-1">
                Auto-calculated from distance ({perKmRateLabel(draft.transportType, travelRates)}) — not editable
              </p>
            )}
          </div>
        </div>

        {draft.category === 'travel' && (
          <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50/50">
            <h3 className="font-semibold text-blue-900">Travel</h3>
            <div>
              <Label>Travel mode *</Label>
              <Select
                value={draft.transportType || undefined}
                onValueChange={(v) => {
                  const kms = parseFloat(draft.approxKms) || 0
                  const amt = isPerKmTravelMode(v) ? calcTravelAmount(v, kms, travelRates) : ''
                  setDraft({
                    ...draft,
                    transportType: v,
                    amount: isPerKmTravelMode(v) ? amt : draft.amount,
                  })
                }}
              >
                <SelectTrigger className="bg-white mt-1">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {TRAVEL_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>From *</Label>
                <Input
                  className="bg-white mt-1"
                  value={draft.travelFrom}
                  onChange={(e) => setDraft({ ...draft, travelFrom: e.target.value })}
                  placeholder="Hyderabad"
                />
              </div>
              <div>
                <Label>To *</Label>
                <Input
                  className="bg-white mt-1"
                  value={draft.travelTo}
                  onChange={(e) => setDraft({ ...draft, travelTo: e.target.value })}
                  placeholder="Vijayawada"
                />
              </div>
            </div>
            <div>
              <Label>Total distance claimed (km) *</Label>
              <Input
                type="number"
                className="bg-white mt-1"
                value={draft.approxKms}
                onChange={(e) => {
                  const kms = e.target.value
                  const amt = isPerKmTravelMode(draft.transportType)
                    ? calcTravelAmount(draft.transportType, parseFloat(kms) || 0, travelRates)
                    : draft.amount
                  setDraft({
                    ...draft,
                    approxKms: kms,
                    amount: isPerKmTravelMode(draft.transportType) ? amt : draft.amount,
                  })
                }}
              />
              {isPerKmTravelMode(draft.transportType) && (
                <p className="text-xs text-blue-700 mt-1">
                  Rate: {perKmRateLabel(draft.transportType, travelRates)} — amount updates automatically and is locked
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <Button type="button" variant="outline" onClick={fetchGpsDistance} disabled={gpsLoading}>
                {gpsLoading ? 'Calculating…' : 'Verify distance (GPS)'}
              </Button>
              {gpsNote && <span className="text-sm text-neutral-700">{gpsNote}</span>}
            </div>
            {ticketRequired && (
              <div>
                <Label>Ticket / proof upload *</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  className="bg-white mt-1"
                  onChange={(e) =>
                    setDraft({ ...draft, ticketFile: e.target.files?.[0] || null })
                  }
                />
              </div>
            )}
          </div>
        )}

        {draft.category === 'accommodation' && (
          <div className="space-y-3 p-4 border border-purple-200 rounded-lg bg-purple-50/50">
            <h3 className="font-semibold text-purple-900">Accommodation</h3>
            <div>
              <Label>Lodge / hotel name *</Label>
              <Input
                className="bg-white mt-1"
                value={draft.lodgeName}
                onChange={(e) => setDraft({ ...draft, lodgeName: e.target.value })}
              />
            </div>
            <div>
              <Label>City *</Label>
              <Input
                className="bg-white mt-1"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Stay from *</Label>
                <Input
                  type="date"
                  className="bg-white mt-1"
                  value={draft.stayDate}
                  onChange={(e) => setDraft({ ...draft, stayDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Stay to *</Label>
                <Input
                  type="date"
                  className="bg-white mt-1"
                  min={draft.stayDate || undefined}
                  value={draft.stayDateEnd}
                  onChange={(e) => setDraft({ ...draft, stayDateEnd: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Bill photo *</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                className="bg-white mt-1"
                onChange={(e) => setDraft({ ...draft, billFile: e.target.files?.[0] || null })}
              />
            </div>
          </div>
        )}

        {draft.category === 'food' && (
          <div className="space-y-3 p-4 border border-orange-200 rounded-lg bg-orange-50/50">
            <h3 className="font-semibold text-orange-900">Food</h3>
            <div>
              <Label>Restaurant name *</Label>
              <Input
                className="bg-white mt-1"
                value={draft.restaurantName}
                onChange={(e) => setDraft({ ...draft, restaurantName: e.target.value })}
              />
            </div>
            <div>
              <Label>Meal date *</Label>
              <Input
                type="date"
                className="bg-white mt-1"
                value={draft.mealDate}
                onChange={(e) => setDraft({ ...draft, mealDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Bill upload{billRequired ? ' *' : ''}</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                className="bg-white mt-1"
                onChange={(e) => setDraft({ ...draft, billFile: e.target.files?.[0] || null })}
              />
            </div>
          </div>
        )}

        {draft.category === 'other' && (
          <div className="space-y-3 p-4 border border-neutral-200 rounded-lg bg-neutral-50">
            <h3 className="font-semibold">Other expenses</h3>
            <div>
              <Label>Type *</Label>
              <Select
                value={draft.otherExpenseType}
                onValueChange={(v) => setDraft({ ...draft, otherExpenseType: v })}
              >
                <SelectTrigger className="bg-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OTHER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.otherExpenseType === 'Other' && (
              <div>
                <Label>Name *</Label>
                <Input
                  className="bg-white mt-1"
                  value={draft.expenseName}
                  onChange={(e) => setDraft({ ...draft, expenseName: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label>Description *</Label>
              <Textarea
                className="bg-white mt-1"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>Proof upload{billRequired ? ' *' : ''}</Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                className="bg-white mt-1"
                onChange={(e) => setDraft({ ...draft, billFile: e.target.files?.[0] || null })}
              />
            </div>
          </div>
        )}

        <div>
          <Label>Remarks</Label>
          <Textarea
            className="bg-white mt-1"
            value={draft.remarks}
            onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
            rows={2}
          />
        </div>

        {showGlobalBillUpload && (
          <div>
            <Label>Bill / receipt upload{billRequired ? ' *' : ''}</Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              className="bg-white mt-1"
              onChange={(e) => setDraft({ ...draft, billFile: e.target.files?.[0] || null })}
            />
          </div>
        )}

        <Button type="button" variant="outline" onClick={addToCart} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add to list
        </Button>
      </Card>

      {cart.length > 0 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Submission list ({cart.length})</h2>
          <ul className="space-y-2 text-sm">
            {cart.map((line) => (
              <li
                key={line.id}
                className="flex justify-between items-center border rounded-md px-3 py-2"
              >
                <span>
                  {line.category} — ₹{line.amount}
                  {line.category === 'travel' && line.approxKms
                    ? ` (${line.approxKms} km claimed)`
                    : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCart((c) => c.filter((x) => x.id !== line.id))}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm border-t pt-3">
            <div>Travel: ₹{totals.travel.toFixed(2)}</div>
            <div>Stay: ₹{totals.accommodation.toFixed(2)}</div>
            <div>Food: ₹{totals.food.toFixed(2)}</div>
            <div>Other: ₹{totals.other.toFixed(2)}</div>
            <div className="font-semibold">Total: ₹{totals.grandTotal.toFixed(2)}</div>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            disabled={submitting}
            onClick={submitAll}
          >
            {submitting ? 'Submitting…' : 'Submit all for approval'}
          </Button>
        </Card>
      )}
    </div>
  )
}
