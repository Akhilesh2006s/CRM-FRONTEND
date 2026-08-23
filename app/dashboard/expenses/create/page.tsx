'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, LOCAL_API_BASE_URL } from '@/lib/api'
import { toast } from 'sonner'

type DC = {
  _id: string
  dcOrderId?: {
    school_name?: string
    school_code?: string
    zone?: string
  }
  saleId?: {
    customerName?: string
  }
}

export default function CreateExpensePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [myDCs, setMyDCs] = useState<DC[]>([])
  const [loadingDCs, setLoadingDCs] = useState(true)
  const [billUrl, setBillUrl] = useState<string>('')
  const [billFile, setBillFile] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ receiptNumber?: string; bill?: string }>({})

  const [form, setForm] = useState({
    type: '', // travel, food, accommodation, others
    date: new Date().toISOString().split('T')[0],
    amount: '',
    receiptNumber: '',
    remarks: '',
    // Travel-specific fields
    transportType: '',
    travelFrom: '',
    travelTo: '',
    approxKms: '',
    dcId: '',
  })

  // Fetch employee's assigned DCs
  useEffect(() => {
    const fetchMyDCs = async () => {
      try {
        setLoadingDCs(true)
        const dcs = await apiRequest<DC[]>('/dc/employee/my')
        setMyDCs(dcs || [])
      } catch (error: any) {
        console.error('Error fetching DCs:', error)
      } finally {
        setLoadingDCs(false)
      }
    }

    fetchMyDCs()
  }, [])

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setBillFile(null)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only image files (JPG, PNG) and PDF files are allowed')
      e.target.value = ''
      setBillFile(null)
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      e.target.value = ''
      setBillFile(null)
      return
    }

    // File will be uploaded with the form submission
    setBillFile(file)
    setBillUrl('')
    setFieldErrors((prev) => ({ ...prev, bill: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validate required fields
      if (!form.type || !form.amount || !form.date) {
        toast.error('Please fill in all required fields (Type, Date, Amount)')
        setSubmitting(false)
        return
      }

      // Validate travel-specific fields if type is travel
      if (form.type === 'travel') {
        if (!form.transportType || !form.travelFrom || !form.travelTo) {
          toast.error('Please fill in all required travel fields (Transport Type, From, To)')
          setSubmitting(false)
          return
        }
      }

      // Validate DC selection if DCs are available
      if (myDCs.length > 0 && (!form.dcId || form.dcId === 'none')) {
        toast.error('Please select a School/DC for this expense')
        setSubmitting(false)
        return
      }

      const nextErrors: { receiptNumber?: string; bill?: string } = {}
      if (!form.receiptNumber.trim()) {
        nextErrors.receiptNumber = 'Receipt No is required.'
      }
      const fileInput = document.getElementById('bill') as HTMLInputElement
      const file = billFile || fileInput?.files?.[0] || null
      if (!file && !billUrl) {
        nextErrors.bill = 'Bill upload is required.'
      }
      setFieldErrors(nextErrors)
      if (nextErrors.receiptNumber || nextErrors.bill) {
        if (nextErrors.receiptNumber) toast.error(nextErrors.receiptNumber)
        else if (nextErrors.bill) toast.error(nextErrors.bill)
        setSubmitting(false)
        return
      }

      const expenseData: any = {
        title: `${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Expense`,
        category: form.type,
        amount: parseFloat(form.amount),
        date: form.date,
        receiptNumber: form.receiptNumber.trim(),
        employeeRemarks: form.remarks || undefined,
        status: 'Pending',
        dcId: form.dcId && form.dcId !== 'none' ? form.dcId : undefined,
      }

      // Add travel-specific fields
      if (form.type === 'travel') {
        expenseData.transportType = form.transportType
        expenseData.travelFrom = form.travelFrom
        expenseData.travelTo = form.travelTo
        if (form.approxKms) {
          expenseData.approxKms = parseFloat(form.approxKms)
        }
      }

      // Add bill URL if uploaded separately
      if (billUrl) {
        expenseData.receipt = billUrl
      }

      // If we have a file, use FormData, otherwise use JSON
      if (file) {
        const formData = new FormData()
        Object.keys(expenseData).forEach((key) => {
          if (expenseData[key] !== undefined && expenseData[key] !== null) {
            formData.append(key, expenseData[key].toString())
          }
        })
        formData.append('bill', file)

        const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
        const headers: HeadersInit = {}
        if (token) {
          headers["Authorization"] = `Bearer ${token}`
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || LOCAL_API_BASE_URL}/api/expenses/create`, {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!res.ok) {
          let message = "Request failed"
          try {
            const data = await res.json()
            message = data?.message || message
          } catch (_) {}
          throw new Error(message)
        }

        await res.json()
      } else {
        // No file, use regular JSON request
        await apiRequest('/expenses/create', {
          method: 'POST',
          body: JSON.stringify(expenseData),
        })
      }

      toast.success('Expense created successfully')
      router.push('/dashboard/expenses/my')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create expense')
    } finally {
      setSubmitting(false)
    }
  }

  const isTravelType = form.type === 'travel'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Create Expense</h1>
      </div>

      <Card className="p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Dropdown */}
          <div>
            <Label htmlFor="type">Type *</Label>
            <Select
              value={form.type}
              onValueChange={(value) => setForm({ ...form, type: value, transportType: '', travelFrom: '', travelTo: '', approxKms: '' })}
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

          {/* Date */}
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="bg-white"
            />
          </div>

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              className="bg-white"
              placeholder="0.00"
            />
          </div>

          {/* Receipt Number */}
          <div>
            <Label htmlFor="receiptNumber">Receipt No. *</Label>
            <Input
              id="receiptNumber"
              type="text"
              value={form.receiptNumber}
              onChange={(e) => {
                setForm({ ...form, receiptNumber: e.target.value })
                if (fieldErrors.receiptNumber) {
                  setFieldErrors((prev) => ({ ...prev, receiptNumber: undefined }))
                }
              }}
              className={`bg-white ${fieldErrors.receiptNumber ? 'border-red-500' : ''}`}
              placeholder="Enter receipt number"
            />
            {fieldErrors.receiptNumber && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.receiptNumber}</p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="bg-white"
              placeholder="Enter remarks"
              rows={3}
            />
          </div>

          {/* Bill Upload */}
          <div>
            <Label htmlFor="bill">Upload Bill *</Label>
            <Input
              id="bill"
              type="file"
              accept="image/*,.pdf"
              onChange={handleBillUpload}
              disabled={submitting}
              className={`bg-white ${fieldErrors.bill ? 'border-red-500' : ''}`}
            />
            {fieldErrors.bill && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.bill}</p>
            )}
            <p className="text-sm text-neutral-500 mt-1">Accepted formats: JPG, PNG, PDF (Max 5MB)</p>
          </div>

          {/* Travel-specific fields - shown conditionally */}
          {isTravelType && (
            <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="font-semibold text-blue-900">Travel Details</h3>
              
              {/* Travel mode — same options as navbar-landing reimbursement flow */}
              <div>
                <Label htmlFor="transportType">Travel mode *</Label>
                <Select
                  value={form.transportType}
                  onValueChange={(value) => setForm({ ...form, transportType: value })}
                  required
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* From */}
              <div>
                <Label htmlFor="travelFrom">From *</Label>
                <Input
                  id="travelFrom"
                  type="text"
                  value={form.travelFrom}
                  onChange={(e) => setForm({ ...form, travelFrom: e.target.value })}
                  required
                  className="bg-white"
                  placeholder="Enter origin location"
                />
              </div>

              {/* To */}
              <div>
                <Label htmlFor="travelTo">To *</Label>
                <Input
                  id="travelTo"
                  type="text"
                  value={form.travelTo}
                  onChange={(e) => setForm({ ...form, travelTo: e.target.value })}
                  required
                  className="bg-white"
                  placeholder="Enter destination location"
                />
              </div>

              {/* Approx Kms */}
              <div>
                <Label htmlFor="approxKms">Approx Kms</Label>
                <Input
                  id="approxKms"
                  type="number"
                  step="0.01"
                  value={form.approxKms}
                  onChange={(e) => setForm({ ...form, approxKms: e.target.value })}
                  className="bg-white"
                  placeholder="Enter approximate kilometers"
                />
              </div>
            </div>
          )}

          {/* School/DC Selection */}
          {myDCs.length > 0 && (
            <div>
              <Label htmlFor="dcId">
                School / DC *
              </Label>
              <Select
                value={form.dcId}
                onValueChange={(value) => setForm({ ...form, dcId: value })}
                required
                disabled={loadingDCs}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={
                    loadingDCs 
                      ? "Loading assigned DCs..." 
                      : "Select school/DC"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {myDCs.map((dc) => {
                    const schoolName = dc.dcOrderId?.school_name || dc.saleId?.customerName || 'Unknown School'
                    const schoolCode = dc.dcOrderId?.school_code || ''
                    const zone = dc.dcOrderId?.zone || ''
                    const displayName = schoolCode ? `${schoolCode} - ${schoolName}` : schoolName
                    const displayText = zone ? `${displayName} (${zone})` : displayName
                    
                    return (
                      <SelectItem key={dc._id} value={dc._id}>
                        {displayText}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Creating...' : 'Create Expense'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
