'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, apiUrl } from '@/lib/api'
import {
  calcTravelAmount,
  isTravelAmountLocked,
  perKmRateLabel,
  type TravelPerKmRates,
} from '@/lib/expenseTravelRates'
import { toast } from 'sonner'

type FieldErrors = Partial<Record<'receiptNumber' | 'remarks' | 'bill' | 'hotelName' | 'hotelAddress' | 'checkInDate' | 'checkOutDate' | 'approxKms', string>>

export default function CreateExpensePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [billFile, setBillFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [rates, setRates] = useState<Partial<TravelPerKmRates>>({})
  // Travel modes that need a bill / ticket upload (Super Admin → Expense Policy).
  const [ticketModes, setTicketModes] = useState<string[] | null>(null)

  const [form, setForm] = useState({
    type: '', // travel, food, accommodation, others
    date: new Date().toISOString().split('T')[0],
    amount: '',
    receiptNumber: '',
    remarks: '',
    // Travel
    transportType: '',
    travelFrom: '',
    travelTo: '',
    approxKms: '',
    // Food / Accommodation
    hotelName: '',
    hotelAddress: '',
    checkInDate: '',
    checkOutDate: '',
  })

  // Per-km rates for Bike / Car come from the expense policy (defaults ₹2.80 / ₹8).
  useEffect(() => {
    apiRequest<Partial<TravelPerKmRates> & { requireTicketForModes?: string[] }>('/expenses/policy')
      .then((policy) => {
        setRates(policy || {})
        setTicketModes(Array.isArray(policy?.requireTicketForModes) ? policy.requireTicketForModes : [])
      })
      .catch(() => setRates({}))
  }, [])

  const amountLocked = isTravelAmountLocked(form.type, form.transportType)
  const autoAmount = amountLocked ? calcTravelAmount(form.transportType, Number(form.approxKms) || 0, rates) : ''
  const amountValue = amountLocked ? autoAmount : form.amount
  // Travel needs a bill / ticket only in the modes the expense policy lists; other types always need a bill.
  const billOptional =
    form.type === 'travel' &&
    !!form.transportType &&
    ticketModes !== null &&
    !ticketModes.some((m) => m.trim().toLowerCase() === form.transportType.toLowerCase())
  const needsHotel = form.type === 'food' || form.type === 'accommodation'
  const isStay = form.type === 'accommodation'
  const isTravelType = form.type === 'travel'

  const update = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    const keys = Object.keys(patch) as (keyof FieldErrors)[]
    if (keys.some((k) => fieldErrors[k])) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        keys.forEach((k) => delete next[k])
        return next
      })
    }
  }

  const handleBillUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setBillFile(null)
      return
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only image files (JPG, PNG) and PDF files are allowed')
      e.target.value = ''
      setBillFile(null)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      e.target.value = ''
      setBillFile(null)
      return
    }
    setBillFile(file)
    setFieldErrors((prev) => ({ ...prev, bill: undefined }))
  }

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (!form.remarks.trim()) errors.remarks = 'Remarks are required.'
    if (isTravelType && amountLocked && !(Number(form.approxKms) > 0)) errors.approxKms = 'Enter the kilometres travelled.'
    if (needsHotel) {
      if (!form.hotelName.trim()) errors.hotelName = 'Hotel Name is required.'
      if (!form.hotelAddress.trim()) errors.hotelAddress = 'Hotel Address is required.'
    }
    if (isStay) {
      if (!form.checkInDate) errors.checkInDate = 'Check-in Date is required.'
      if (!form.checkOutDate) errors.checkOutDate = 'Check-out Date is required.'
      else if (form.checkInDate && form.checkOutDate < form.checkInDate) {
        errors.checkOutDate = 'Check-out must be on or after Check-in.'
      }
    }
    if (!billOptional) {
      if (!billFile) errors.bill = 'Bill upload is required.'
    }
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.type || !form.date || !(Number(amountValue) > 0)) {
      toast.error(amountLocked ? 'Enter the kilometres travelled to calculate the amount' : 'Please fill in Type, Date and Amount')
      return
    }
    if (isTravelType && (!form.transportType || !form.travelFrom.trim() || !form.travelTo.trim())) {
      toast.error('Please fill in all required travel fields (Travel mode, From, To)')
      return
    }
    const errors = validate()
    setFieldErrors(errors)
    const firstError = Object.values(errors).find(Boolean)
    if (firstError) {
      toast.error(firstError)
      return
    }

    setSubmitting(true)
    try {
      const expenseData: Record<string, string | number | undefined> = {
        title: `${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Expense`,
        category: form.type,
        amount: Number(amountValue),
        date: isStay ? form.checkInDate || form.date : form.date,
        receiptNumber: form.receiptNumber.trim() || undefined,
        employeeRemarks: form.remarks.trim() || undefined,
        status: 'Pending',
      }
      if (isTravelType) {
        expenseData.transportType = form.transportType
        expenseData.travelFrom = form.travelFrom.trim()
        expenseData.travelTo = form.travelTo.trim()
        if (form.approxKms) expenseData.approxKms = Number(form.approxKms)
      }
      if (needsHotel) {
        expenseData.hotelName = form.hotelName.trim()
        expenseData.hotelAddress = form.hotelAddress.trim()
      }
      if (isStay) {
        expenseData.checkInDate = form.checkInDate
        expenseData.checkOutDate = form.checkOutDate
      }

      if (billFile) {
        const formData = new FormData()
        Object.entries(expenseData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) formData.append(key, String(value))
        })
        formData.append('bill', billFile)
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
        const res = await fetch(apiUrl('/expenses/create'), {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        if (!res.ok) {
          let message = 'Request failed'
          try {
            message = (await res.json())?.message || message
          } catch (_) {}
          throw new Error(message)
        }
        await res.json()
      } else {
        await apiRequest('/expenses/create', { method: 'POST', body: JSON.stringify(expenseData) })
      }

      toast.success('Expense created successfully')
      router.push('/dashboard/expenses/my?view=pending')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create expense')
    } finally {
      setSubmitting(false)
    }
  }

  const errorText = (key: keyof FieldErrors) =>
    fieldErrors[key] ? <p className="text-xs text-red-600 mt-1">{fieldErrors[key]}</p> : null
  const errorClass = (key: keyof FieldErrors) => (fieldErrors[key] ? 'border-red-500' : '')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Create Expense</h1>
      </div>

      <Card className="p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                update({ type: value, transportType: '', travelFrom: '', travelTo: '', approxKms: '', hotelName: '', hotelAddress: '', checkInDate: '', checkOutDate: '' })
              }
              required
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select expense type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="food">Food</SelectItem>
                <SelectItem value="accommodation">Accommodation</SelectItem>
                <SelectItem value="others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isStay && (
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                allowPastDates
                value={form.date}
                onChange={(e) => update({ date: e.target.value })}
                required
                className="bg-white"
              />
            </div>
          )}

          {isTravelType && (
            <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="font-semibold text-blue-900">Travel Details</h3>
              <div>
                <Label htmlFor="transportType">Travel mode *</Label>
                <Select value={form.transportType} onValueChange={(value) => update({ transportType: value })} required>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                        {m === 'Bike' || m === 'Car' ? ` (${perKmRateLabel(m, rates)})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="travelFrom">From *</Label>
                <Input id="travelFrom" value={form.travelFrom} onChange={(e) => update({ travelFrom: e.target.value })} required className="bg-white" placeholder="Enter origin location" />
              </div>
              <div>
                <Label htmlFor="travelTo">To *</Label>
                <Input id="travelTo" value={form.travelTo} onChange={(e) => update({ travelTo: e.target.value })} required className="bg-white" placeholder="Enter destination location" />
              </div>
              <div>
                <Label htmlFor="approxKms">Kilometres{amountLocked ? ' *' : ''}</Label>
                <Input
                  id="approxKms"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.approxKms}
                  onChange={(e) => update({ approxKms: e.target.value })}
                  className={`bg-white ${errorClass('approxKms')}`}
                  placeholder="Enter kilometres travelled"
                />
                {errorText('approxKms')}
              </div>
            </div>
          )}

          {needsHotel && (
            <div className="space-y-4 p-4 border border-amber-200 rounded-lg bg-amber-50">
              <h3 className="font-semibold text-amber-900">{isStay ? 'Stay Details' : 'Hotel Details'}</h3>
              {isStay && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="checkInDate">Check-in Date *</Label>
                    <Input id="checkInDate" type="date" allowPastDates value={form.checkInDate} onChange={(e) => update({ checkInDate: e.target.value })} className={`bg-white ${errorClass('checkInDate')}`} />
                    {errorText('checkInDate')}
                  </div>
                  <div>
                    <Label htmlFor="checkOutDate">Check-out Date *</Label>
                    <Input id="checkOutDate" type="date" allowPastDates value={form.checkOutDate} min={form.checkInDate || undefined} onChange={(e) => update({ checkOutDate: e.target.value })} className={`bg-white ${errorClass('checkOutDate')}`} />
                    {errorText('checkOutDate')}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="hotelName">Hotel Name *</Label>
                <Input id="hotelName" value={form.hotelName} onChange={(e) => update({ hotelName: e.target.value })} className={`bg-white ${errorClass('hotelName')}`} placeholder="Enter hotel name" />
                {errorText('hotelName')}
              </div>
              <div>
                <Label htmlFor="hotelAddress">Hotel Address *</Label>
                <Textarea id="hotelAddress" value={form.hotelAddress} onChange={(e) => update({ hotelAddress: e.target.value })} className={`bg-white ${errorClass('hotelAddress')}`} placeholder="Enter hotel address" rows={2} />
                {errorText('hotelAddress')}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amountValue}
              onChange={(e) => update({ amount: e.target.value })}
              readOnly={amountLocked}
              required
              className={amountLocked ? 'bg-neutral-100 font-semibold' : 'bg-white'}
              placeholder={amountLocked ? 'Calculated from kilometres' : '0.00'}
            />
            {amountLocked && (
              <p className="text-xs text-neutral-500 mt-1">
                Calculated automatically: kilometres × {perKmRateLabel(form.transportType, rates)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="receiptNumber">Bill Number</Label>
            <Input
              id="receiptNumber"
              value={form.receiptNumber}
              onChange={(e) => update({ receiptNumber: e.target.value })}
              className={`bg-white ${errorClass('receiptNumber')}`}
              placeholder="Optional"
            />
            {errorText('receiptNumber')}
          </div>

          <div>
            <Label htmlFor="remarks">Remarks *</Label>
            <Textarea
              id="remarks"
              value={form.remarks}
              onChange={(e) => update({ remarks: e.target.value })}
              className={`bg-white ${errorClass('remarks')}`}
              placeholder="What was this expense for?"
              rows={3}
            />
            {errorText('remarks')}
          </div>

          <div>
            <Label htmlFor="bill">{form.type === 'travel' ? 'Upload Bill / Ticket' : 'Upload Bill'}{billOptional ? ` (optional for ${form.transportType})` : ' *'}</Label>
            <Input
              id="bill"
              type="file"
              accept="image/*,.pdf"
              onChange={handleBillUpload}
              disabled={submitting}
              className={`bg-white ${errorClass('bill')}`}
            />
            {errorText('bill')}
            <p className="text-sm text-neutral-500 mt-1">Accepted formats: JPG, PNG, PDF (Max 5MB)</p>
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? 'Creating...' : 'Create Expense'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
