'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
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
  
  // Payment mode specific fields
  const [upiId, setUpiId] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [paymentGateway, setPaymentGateway] = useState('')
  const [otherDetails, setOtherDetails] = useState('')

  useEffect(() => {
    async function loadSchools() {
      try {
        const currentUser = getCurrentUser()
        if (!currentUser || !currentUser._id) {
          toast.error('User not found. Please login again.')
          setLoading(false)
          return
        }

        // For employees, only show their clients/schools
        // For admins/managers, show all schools
        const isEmployee = currentUser.role === 'Employee' || currentUser.role === 'Sales BDE'
        
        if (isEmployee) {
          // Get schools from multiple sources for this employee
          const [dcs, leads, dcOrders] = await Promise.all([
            apiRequest<any[]>(`/dc?employeeId=${currentUser._id}`).catch(() => []),
            apiRequest<any[]>(`/leads?assignedTo=${currentUser._id}`).catch(() => []),
            apiRequest<any[]>(`/dc-orders?assigned_to=${currentUser._id}`).catch(() => []),
          ])

          // Extract unique schools from all sources
          const schoolMap = new Map<string, School>()
          
          // From DCs
          dcs.forEach((dc: any) => {
            const schoolName = dc.customerName || dc.dcOrderId?.school_name || ''
            if (schoolName && !schoolMap.has(schoolName)) {
              schoolMap.set(schoolName, {
                _id: dc._id || dc.dcOrderId?._id || '',
                schoolCode: dc.dcOrderId?.dc_code || '',
                schoolName: schoolName,
                contactName: dc.dcOrderId?.contact_person || dc.customerName || '',
                mobileNumber: dc.customerPhone || dc.dcOrderId?.contact_mobile || '',
                location: dc.customerAddress || dc.dcOrderId?.location || '',
              })
            }
          })
          
          // From Leads
          leads.forEach((lead: any) => {
            const schoolName = lead.school_name || ''
            if (schoolName && !schoolMap.has(schoolName)) {
              schoolMap.set(schoolName, {
                _id: lead._id || '',
                schoolCode: lead.school_code || '',
                schoolName: schoolName,
                contactName: lead.contact_person || '',
                mobileNumber: lead.contact_mobile || '',
                location: lead.location || '',
              })
            }
          })
          
          // From DcOrders
          dcOrders.forEach((order: any) => {
            const schoolName = order.school_name || ''
            if (schoolName && !schoolMap.has(schoolName)) {
              schoolMap.set(schoolName, {
                _id: order._id || '',
                schoolCode: order.dc_code || '',
                schoolName: schoolName,
                contactName: order.contact_person || '',
                mobileNumber: order.contact_mobile || '',
                location: order.location || '',
              })
            }
          })
          
          setSchools(Array.from(schoolMap.values()))
        } else {
          // For admins/managers, show all schools
          const data = await apiRequest<School[]>('/schools')
          setSchools(data)
        }
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
    
    // Validate payment mode specific fields
    if (mode === 'UPI' && !upiId.trim()) {
      toast.error('Please enter UPI ID')
      return
    }
    if (mode === 'NEFT/RTGS' && !transactionId.trim()) {
      toast.error('Please enter Transaction ID')
      return
    }
    if (mode === 'Cheque' && (!chequeNumber.trim() || !chequeDate)) {
      toast.error('Please enter Cheque Number and Cheque Date')
      return
    }
    if (mode === 'Bank Transfer' && !transactionId.trim()) {
      toast.error('Please enter Transaction ID')
      return
    }
    if (mode === 'Credit Card' && !cardLast4.trim()) {
      toast.error('Please enter Card Last 4 Digits')
      return
    }
    if (mode === 'Debit Card' && !cardLast4.trim()) {
      toast.error('Please enter Card Last 4 Digits')
      return
    }
    if (mode === 'Online Payment' && !transactionId.trim()) {
      toast.error('Please enter Transaction ID')
      return
    }
    
    setSaving(true)
    try {
      const selectedSchool = schools.find(s => s.schoolName === school)
      
      // Build payment details object based on mode
      const paymentDetails: any = {
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
        status: 'Pending',
      }
      
      // Add mode-specific fields
      if (mode === 'UPI') {
        paymentDetails.upiId = upiId
        paymentDetails.referenceNumber = upiId
      } else if (mode === 'NEFT/RTGS') {
        paymentDetails.transactionId = transactionId
        paymentDetails.referenceNumber = transactionId
        paymentDetails.bankName = bankName || undefined
        paymentDetails.accountNumber = accountNumber || undefined
        paymentDetails.ifscCode = ifscCode || undefined
        paymentDetails.txnNo = transactionId
      } else if (mode === 'Cheque') {
        paymentDetails.chequeNumber = chequeNumber
        paymentDetails.referenceNumber = chequeNumber
        paymentDetails.chqDate = chequeDate ? new Date(chequeDate).toISOString() : undefined
        paymentDetails.bankName = bankName || undefined
      } else if (mode === 'Bank Transfer') {
        paymentDetails.transactionId = transactionId
        paymentDetails.referenceNumber = transactionId
        paymentDetails.bankName = bankName || undefined
        paymentDetails.accountNumber = accountNumber || undefined
        paymentDetails.ifscCode = ifscCode || undefined
        paymentDetails.txnNo = transactionId
      } else if (mode === 'Credit Card' || mode === 'Debit Card') {
        paymentDetails.cardLast4 = cardLast4
        paymentDetails.referenceNumber = cardLast4
        paymentDetails.bankName = bankName || undefined
      } else if (mode === 'Online Payment') {
        paymentDetails.transactionId = transactionId
        paymentDetails.referenceNumber = transactionId
        paymentDetails.paymentGateway = paymentGateway || undefined
        paymentDetails.txnNo = transactionId
      } else if (mode === 'Other') {
        paymentDetails.otherDetails = otherDetails
        paymentDetails.referenceNumber = otherDetails || undefined
      }
      // Cash mode doesn't need additional fields
      
      await apiRequest('/payments/create', {
        method: 'POST',
        body: JSON.stringify(paymentDetails),
      })
      toast.success('Payment added')
      
      // Reset form
      setSchool(undefined)
      setAmount('')
      setMode('Cash')
      setRemarks('')
      setUpiId('')
      setTransactionId('')
      setChequeNumber('')
      setChequeDate('')
      setBankName('')
      setAccountNumber('')
      setIfscCode('')
      setCardLast4('')
      setPaymentGateway('')
      setOtherDetails('')
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
              <Select value={mode} onValueChange={(v) => {
                setMode(v)
                // Clear all payment details when mode changes
                setUpiId('')
                setTransactionId('')
                setChequeNumber('')
                setChequeDate('')
                setBankName('')
                setAccountNumber('')
                setIfscCode('')
                setCardLast4('')
                setPaymentGateway('')
                setOtherDetails('')
              }}>
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
            
            {/* Payment Mode Specific Fields */}
            {mode === 'UPI' && (
              <div className="md:col-span-2">
                <Label>UPI ID *</Label>
                <Input 
                  placeholder="Enter UPI ID (e.g., name@paytm, phone@upi)" 
                  value={upiId} 
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-white text-neutral-900"
                  required
                />
              </div>
            )}
            
            {mode === 'NEFT/RTGS' && (
              <>
                <div>
                  <Label>Transaction ID *</Label>
                  <Input 
                    placeholder="Enter NEFT/RTGS Transaction ID" 
                    value={transactionId} 
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="bg-white text-neutral-900"
                    required
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="Enter Bank Name" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input 
                    placeholder="Enter Account Number" 
                    value={accountNumber} 
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input 
                    placeholder="Enter IFSC Code" 
                    value={ifscCode} 
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="bg-white text-neutral-900"
                  />
                </div>
              </>
            )}
            
            {mode === 'Cheque' && (
              <>
                <div>
                  <Label>Cheque Number *</Label>
                  <Input 
                    placeholder="Enter Cheque Number" 
                    value={chequeNumber} 
                    onChange={(e) => setChequeNumber(e.target.value)}
                    className="bg-white text-neutral-900"
                    required
                  />
                </div>
                <div>
                  <Label>Cheque Date *</Label>
                  <Input 
                    type="date"
                    value={chequeDate} 
                    onChange={(e) => setChequeDate(e.target.value)}
                    className="bg-white text-neutral-900"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="Enter Bank Name" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
              </>
            )}
            
            {mode === 'Bank Transfer' && (
              <>
                <div>
                  <Label>Transaction ID *</Label>
                  <Input 
                    placeholder="Enter Transaction ID" 
                    value={transactionId} 
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="bg-white text-neutral-900"
                    required
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="Enter Bank Name" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input 
                    placeholder="Enter Account Number" 
                    value={accountNumber} 
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
                <div>
                  <Label>IFSC Code</Label>
                  <Input 
                    placeholder="Enter IFSC Code" 
                    value={ifscCode} 
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="bg-white text-neutral-900"
                  />
                </div>
              </>
            )}
            
            {(mode === 'Credit Card' || mode === 'Debit Card') && (
              <>
                <div>
                  <Label>Card Last 4 Digits *</Label>
                  <Input 
                    placeholder="Enter last 4 digits (e.g., 1234)" 
                    value={cardLast4} 
                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="bg-white text-neutral-900"
                    maxLength={4}
                    required
                  />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input 
                    placeholder="Enter Bank/Card Issuer Name" 
                    value={bankName} 
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-white text-neutral-900"
                  />
                </div>
              </>
            )}
            
            {mode === 'Online Payment' && (
              <>
                <div>
                  <Label>Transaction ID *</Label>
                  <Input 
                    placeholder="Enter Transaction ID" 
                    value={transactionId} 
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="bg-white text-neutral-900"
                    required
                  />
                </div>
                <div>
                  <Label>Payment Gateway</Label>
                  <Select value={paymentGateway} onValueChange={setPaymentGateway}>
                    <SelectTrigger className="bg-white text-neutral-900">
                      <SelectValue placeholder="Select Payment Gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Razorpay">Razorpay</SelectItem>
                      <SelectItem value="PayU">PayU</SelectItem>
                      <SelectItem value="Paytm">Paytm</SelectItem>
                      <SelectItem value="PhonePe">PhonePe</SelectItem>
                      <SelectItem value="Google Pay">Google Pay</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {mode === 'Other' && (
              <div className="md:col-span-2">
                <Label>Payment Details *</Label>
                <Textarea 
                  placeholder="Enter payment details (e.g., payment method, reference number, etc.)" 
                  value={otherDetails} 
                  onChange={(e) => setOtherDetails(e.target.value)}
                  className="bg-white text-neutral-900"
                  rows={3}
                  required
                />
              </div>
            )}
            
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
              setUpiId('')
              setTransactionId('')
              setChequeNumber('')
              setChequeDate('')
              setBankName('')
              setAccountNumber('')
              setIfscCode('')
              setCardLast4('')
              setPaymentGateway('')
              setOtherDetails('')
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
