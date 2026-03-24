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
    hotelName: '',
    hotelAddress: '',
    accommodationDate: '',
    checkInDate: '',
    checkOutDate: '',
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
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only image files (JPG, PNG) and PDF files are allowed')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    // File will be uploaded with the form submission
    setBillUrl('')
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

      const expenseData: any = {
        title: `${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Expense`,
        category: form.type,
        amount: parseFloat(form.amount),
        date: form.date,
        receiptNumber: form.receiptNumber || undefined,
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

      // Add food/accommodation/others fields
      if (form.hotelName) expenseData.hotelName = form.hotelName
      if (form.hotelAddress) expenseData.hotelAddress = form.hotelAddress
      if (form.accommodationDate) expenseData.accommodationDate = form.accommodationDate
      if (form.checkInDate) expenseData.checkInDate = form.checkInDate
      if (form.checkOutDate) expenseData.checkOutDate = form.checkOutDate
      if (form.type === 'travel' && form.approxKms) expenseData.approxKms = parseFloat(form.approxKms)

      // Add bill URL if uploaded separately
      if (billUrl) {
        expenseData.receipt = billUrl
      }

      // Get the file input element
      const fileInput = document.getElementById('bill') as HTMLInputElement
      const file = fileInput?.files?.[0]

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
  const isFoodType = form.type === 'food'
  const isAccommodationType = form.type === 'accommodation'
  const isOthersType = form.type === 'others'

  // Auto-calculate amount for Bike/Car based on kms
  const handleKmsChange = (kms: string) => {
    const k = parseFloat(kms) || 0
    let calculated = ''
    if (form.transportType === 'Bike') calculated = (k * 2.8).toFixed(2)
    else if (form.transportType === 'Car') calculated = (k * 8).toFixed(2)
    setForm({ ...form, approxKms: kms, amount: calculated || form.amount })
  }

  const handleTransportChange = (value: string) => {
    const k = parseFloat(form.approxKms) || 0
    let calculated = ''
    if (value === 'Bike') calculated = (k * 2.8).toFixed(2)
    else if (value === 'Car') calculated = (k * 8).toFixed(2)
    setForm({ ...form, transportType: value, amount: calculated || form.amount })
  }

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
              onValueChange={(value) => setForm({ 
                ...form, type: value, 
                transportType: '', travelFrom: '', travelTo: '', approxKms: '',
                hotelName: '', hotelAddress: '', accommodationDate: '',
                checkInDate: '', checkOutDate: '',
              })}
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
            <Label htmlFor="receiptNumber">Receipt No.</Label>
            <Input
              id="receiptNumber"
              type="text"
              value={form.receiptNumber}
              onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
              className="bg-white"
              placeholder="Enter receipt number"
            />
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
            <Label htmlFor="bill">Upload Bill</Label>
            <Input
              id="bill"
              type="file"
              accept="image/*,.pdf"
              onChange={handleBillUpload}
              disabled={submitting}
              className="bg-white"
            />
            <p className="text-sm text-neutral-500 mt-1">Accepted formats: JPG, PNG, PDF (Max 5MB)</p>
          </div>

          {/* Food Fields */}
          {isFoodType && (
            <div className="space-y-4 p-4 border border-orange-200 rounded-lg bg-orange-50">
              <h3 className="font-semibold text-orange-900">Food Details</h3>
              <div>
                <Label>Food Date</Label>
                <Input type="date" value={form.accommodationDate}
                  onChange={(e) => setForm({ ...form, accommodationDate: e.target.value })}
                  className="bg-white" />
              </div>
              <div>
                <Label>Hotel Name</Label>
                <Input type="text" value={form.hotelName}
                  onChange={(e) => setForm({ ...form, hotelName: e.target.value })}
                  className="bg-white" placeholder="Enter hotel name" />
              </div>
              <div>
                <Label>Hotel Address</Label>
                <Input type="text" value={form.hotelAddress}
                  onChange={(e) => setForm({ ...form, hotelAddress: e.target.value })}
                  className="bg-white" placeholder="Enter hotel address" />
              </div>
            </div>
          )}

          {/* Accommodation Fields */}
          {isAccommodationType && (
            <div className="space-y-4 p-4 border border-purple-200 rounded-lg bg-purple-50">
              <h3 className="font-semibold text-purple-900">Accommodation Details</h3>
              <div>
                <Label>Accommodation Date</Label>
                <Input type="date" value={form.accommodationDate}
                  onChange={(e) => setForm({ ...form, accommodationDate: e.target.value })}
                  className="bg-white" />
              </div>
              <div>
                <Label>Check In Date</Label>
                <Input type="date" value={form.checkInDate}
                  onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
                  className="bg-white" />
              </div>
              <div>
                <Label>Check Out Date</Label>
                <Input type="date" value={form.checkOutDate}
                  onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
                  className="bg-white" />
              </div>
              <div>
                <Label>Hotel Name</Label>
                <Input type="text" value={form.hotelName}
                  onChange={(e) => setForm({ ...form, hotelName: e.target.value })}
                  className="bg-white" placeholder="Enter hotel name" />
              </div>
              <div>
                <Label>Hotel Address</Label>
                <Input type="text" value={form.hotelAddress}
                  onChange={(e) => setForm({ ...form, hotelAddress: e.target.value })}
                  className="bg-white" placeholder="Enter hotel address" />
              </div>
            </div>
          )}

          {/* Others Fields */}
          {isOthersType && (
            <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-semibold text-gray-900">Other Details</h3>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.accommodationDate}
                  onChange={(e) => setForm({ ...form, accommodationDate: e.target.value })}
                  className="bg-white" />
              </div>
            </div>
          )}

          {/* Travel Fields */}
          {isTravelType && (
            <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
              <h3 className="font-semibold text-blue-900">Travel Details</h3>
              <div>
                <Label>Transport Type *</Label>
                <Select value={form.transportType} onValueChange={handleTransportChange} required>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select transport type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Bus">Bus</SelectItem>
                    <SelectItem value="Train">Train</SelectItem>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Flight">Flight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Travel Date</Label>
                <Input type="date" value={form.accommodationDate}
                  onChange={(e) => setForm({ ...form, accommodationDate: e.target.value })}
                  className="bg-white" />
              </div>
              <div>
                <Label>From *</Label>
                <Input type="text" value={form.travelFrom}
                  onChange={(e) => setForm({ ...form, travelFrom: e.target.value })}
                  required className="bg-white" placeholder="Enter origin location" />
              </div>
              <div>
                <Label>To *</Label>
                <Input type="text" value={form.travelTo}
                  onChange={(e) => setForm({ ...form, travelTo: e.target.value })}
                  required className="bg-white" placeholder="Enter destination location" />
              </div>
              {/* Approx Kms — only for Bike/Car */}
              {(form.transportType === 'Bike' || form.transportType === 'Car') && (
                <div>
                  <Label>Approx Kms</Label>
                  <Input type="number" step="0.01" value={form.approxKms}
                    onChange={(e) => handleKmsChange(e.target.value)}
                    className="bg-white" placeholder="Enter kilometers" />
                  <p className="text-xs text-blue-700 mt-1">
                    Rate: {form.transportType === 'Bike' ? '₹2.8/km' : '₹8/km'} — amount auto-calculated
                  </p>
                </div>
              )}
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
