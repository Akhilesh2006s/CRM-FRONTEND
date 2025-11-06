'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
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

  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    employeeRemarks: '',
    paymentMethod: '',
    pendingMonth: 'none',
    dcId: '', // New field for selected DC
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
        // Don't show error toast, just continue without DC selection
      } finally {
        setLoadingDCs(false)
      }
    }

    fetchMyDCs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Validate required fields
      if (!form.title || !form.amount || !form.category || !form.date) {
        toast.error('Please fill in all required fields')
        return
      }
      
      // Validate DC selection if DCs are available
      if (myDCs.length > 0 && (!form.dcId || form.dcId === 'none')) {
        toast.error('Please select a School/DC for this expense')
        return
      }

      const expenseData = {
        title: form.title,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description || undefined,
        date: form.date,
        employeeRemarks: form.employeeRemarks || undefined,
        paymentMethod: form.paymentMethod && form.paymentMethod !== 'none' ? form.paymentMethod : undefined,
        pendingMonth: form.pendingMonth && form.pendingMonth !== 'none' ? form.pendingMonth : undefined,
        dcId: form.dcId && form.dcId !== 'none' ? form.dcId : undefined,
        status: 'Pending',
      }

      await apiRequest('/expenses/create', {
        method: 'POST',
        body: JSON.stringify(expenseData),
      })

      toast.success('Expense created successfully')
      router.push('/dashboard/expenses/my')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create expense')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Create Expense</h1>
      </div>

      <Card className="p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="bg-white"
              placeholder="Enter expense title"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
                required
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Salary">Salary</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) => setForm({ ...form, paymentMethod: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="dcId">
              School / DC {myDCs.length > 0 && '*'}
            </Label>
            <Select
              value={form.dcId}
              onValueChange={(value) => setForm({ ...form, dcId: value })}
              required={myDCs.length > 0}
              disabled={loadingDCs || myDCs.length === 0}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder={
                  loadingDCs 
                    ? "Loading assigned DCs..." 
                    : myDCs.length === 0 
                      ? "No assigned DCs available" 
                      : "Select school/DC"
                } />
              </SelectTrigger>
              <SelectContent>
                {myDCs.length > 0 && (
                  <SelectItem value="none">None</SelectItem>
                )}
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
            {myDCs.length === 0 && !loadingDCs && (
              <p className="text-sm text-neutral-500 mt-1">No assigned DCs found. You can still create an expense without selecting a DC.</p>
            )}
          </div>

          <div>
            <Label htmlFor="pendingMonth">Pending Month</Label>
            <Select
              value={form.pendingMonth}
              onValueChange={(value) => setForm({ ...form, pendingMonth: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="January">January</SelectItem>
                <SelectItem value="February">February</SelectItem>
                <SelectItem value="March">March</SelectItem>
                <SelectItem value="April">April</SelectItem>
                <SelectItem value="May">May</SelectItem>
                <SelectItem value="June">June</SelectItem>
                <SelectItem value="July">July</SelectItem>
                <SelectItem value="August">August</SelectItem>
                <SelectItem value="September">September</SelectItem>
                <SelectItem value="October">October</SelectItem>
                <SelectItem value="November">November</SelectItem>
                <SelectItem value="December">December</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-white"
              placeholder="Enter expense description"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="employeeRemarks">Employee Remarks</Label>
            <Textarea
              id="employeeRemarks"
              value={form.employeeRemarks}
              onChange={(e) => setForm({ ...form, employeeRemarks: e.target.value })}
              className="bg-white"
              placeholder="Enter any remarks or notes"
              rows={3}
            />
          </div>

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

