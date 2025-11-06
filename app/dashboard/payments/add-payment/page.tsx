'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

const PAYMENT_MODES = ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other']

type School = {
  _id: string
  schoolCode: string
  schoolName: string
  contactName?: string
  mobileNumber?: string
  avgStrength?: number
  location?: string
}

export default function AddPaymentPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [school, setSchool] = useState<string | undefined>(undefined)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('Cash')
  const [financialYear, setFinancialYear] = useState('2024-25')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchools() {
      try {
        const data = await apiRequest<School[]>('/schools')
        setSchools(data)
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load schools')
      } finally {
        setLoading(false)
      }
    }
    loadSchools()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!school || !amount || !mode) {
      toast.error('Please fill all required fields (School, Amount, and Payment Mode)')
      return
    }
    setSaving(true)
    try {
      const selectedSchool = schools.find(s => s.schoolName === school)
      await apiRequest('/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          customerName: school,
          schoolCode: selectedSchool?.schoolCode || '',
          contactName: selectedSchool?.contactName || '',
          mobileNumber: selectedSchool?.mobileNumber || '',
          location: selectedSchool?.location || '',
          amount: Number(amount),
          paymentMethod: mode,
          financialYear,
          description: remarks,
          paymentDate: new Date().toISOString(),
          status: 'Pending', // Always starts as Pending for admin review
        }),
      })
      toast.success('Payment added')
      setSchool(undefined)
      setAmount('')
      setMode('Cash')
      setRemarks('')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Payment</h1>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>School *</Label>
              <Select value={school} onValueChange={setSchool} disabled={loading}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select School" />
                </SelectTrigger>
                <SelectContent>
                  {schools.length > 0 ? (
                    schools.filter(s => s.schoolName && s.schoolName.trim()).map((s) => (
                      <SelectItem key={s._id} value={s.schoolName}>
                        {s.schoolName}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="loading" disabled>
                      {loading ? 'Loading schools...' : 'No schools available'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹) *</Label>
              <Input 
                type="number" 
                placeholder="Enter amount" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white text-neutral-900"
                required
              />
            </div>
            <div>
              <Label>Payment Mode *</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select Payment Mode" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500 mt-1">Select: Cash, UPI, NEFT/RTGS, Cheque, etc.</p>
            </div>
            <div>
              <Label>Financial Year *</Label>
              <Select value={financialYear} onValueChange={setFinancialYear}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2024-25', '2025-26', '2026-27'].map((fy) => (
                    <SelectItem key={fy} value={fy}>{fy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Remarks</Label>
              <Textarea 
                placeholder="Enter any remarks or notes about this payment" 
                value={remarks} 
                onChange={(e) => setRemarks(e.target.value)}
                className="bg-white text-neutral-900"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => {
              setSchool(undefined)
              setAmount('')
              setMode('Cash')
              setRemarks('')
            }}>
              Clear
            </Button>
            <Button type="submit" disabled={saving || !school || !amount}>
              {saving ? 'Saving…' : 'Add Payment'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
