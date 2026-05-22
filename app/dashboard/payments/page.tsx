'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle2, Clock, XCircle, Pause, CreditCard, TrendingUp, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Link from 'next/link'
import { Label } from '@/components/ui/label'

type Payment = {
  _id: string
  amount: number
  paymentMethod: string
  status: 'Pending' | 'Approved' | 'Hold' | 'Rejected'
  paymentDate: string
  customerName?: string
  schoolCode?: string
  createdBy?: { name?: string; email?: string }
  approvedBy?: { name?: string; email?: string }
  rejectedBy?: { name?: string; email?: string }
  heldBy?: { name?: string; email?: string }
  dcId?: string
  autoCreated?: boolean
  paymentBreakdown?: Array<{
    product: string
    class: string
    category: string
    specs: string
    subject?: string
    quantity: number
    strength: number
    level: string
    unitPrice: number
    total: number
    term?: string
  }>
}

export default function PaymentsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'Finance Manager' || currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
  const isManager = currentUser?.role === 'Manager' || isAdmin
  
  const [items, setItems] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [selectedPaymentForInvoice, setSelectedPaymentForInvoice] = useState<Payment | null>(null)
  const [updatePaymentModalOpen, setUpdatePaymentModalOpen] = useState(false)
  const [selectedPaymentForUpdate, setSelectedPaymentForUpdate] = useState<Payment | null>(null)
  const [updateFormData, setUpdateFormData] = useState({
    paymentMethod: '',
    paymentDate: '',
    referenceNumber: '',
    upiId: '',
    transactionId: '',
    chequeNumber: '',
    bankName: '',
    ifscCode: '',
    description: '',
  })
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    paymentMethod: '',
    fromDate: '',
    toDate: '',
  })
  
  const toggleExpanded = (paymentId: string) => {
    const newExpanded = new Set(expandedPayments)
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId)
    } else {
      newExpanded.add(paymentId)
    }
    setExpandedPayments(newExpanded)
  }

  const openInvoiceView = (payment: Payment) => {
    setSelectedPaymentForInvoice(payment)
    setInvoiceModalOpen(true)
  }

  const openUpdatePayment = (payment: Payment) => {
    setSelectedPaymentForUpdate(payment)
    setUpdateFormData({
      paymentMethod: payment.paymentMethod || 'Other',
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      referenceNumber: payment.referenceNumber || payment.refNo || '',
      upiId: (payment as any).upiId || '',
      transactionId: (payment as any).transactionId || '',
      chequeNumber: (payment as any).chequeNumber || '',
      bankName: (payment as any).bankName || '',
      ifscCode: (payment as any).ifscCode || '',
      description: payment.description || '',
    })
    setUpdatePaymentModalOpen(true)
  }

  const handleUpdatePaymentDetails = async () => {
    if (!selectedPaymentForUpdate) return

    setUpdatingPayment(true)
    try {
      const updatePayload: any = {
        paymentMethod: updateFormData.paymentMethod,
        paymentDate: updateFormData.paymentDate,
        referenceNumber: updateFormData.referenceNumber,
        description: updateFormData.description,
      }

      // Add mode-specific fields
      if (updateFormData.paymentMethod === 'UPI') {
        updatePayload.upiId = updateFormData.upiId
        if (!updatePayload.referenceNumber) updatePayload.referenceNumber = updateFormData.upiId
      } else if (updateFormData.paymentMethod === 'NEFT/RTGS') {
        updatePayload.transactionId = updateFormData.transactionId
        updatePayload.txnNo = updateFormData.transactionId
        if (!updatePayload.referenceNumber) updatePayload.referenceNumber = updateFormData.transactionId
        if (updateFormData.bankName) updatePayload.bankName = updateFormData.bankName
        if (updateFormData.ifscCode) updatePayload.ifscCode = updateFormData.ifscCode
      } else if (updateFormData.paymentMethod === 'Cheque') {
        updatePayload.chequeNumber = updateFormData.chequeNumber
        if (!updatePayload.referenceNumber) updatePayload.referenceNumber = updateFormData.chequeNumber
        if (updateFormData.bankName) updatePayload.bankName = updateFormData.bankName
      }

      await apiRequest(`/payments/${selectedPaymentForUpdate._id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      })
      toast.success('Payment details updated successfully')
      setUpdatePaymentModalOpen(false)
      load() // Reload payments
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment details')
    } finally {
      setUpdatingPayment(false)
    }
  }

  const handleUpdatePayment = async (payment: Payment, newStatus: 'Approved' | 'Hold' | 'Rejected') => {
    try {
      await apiRequest(`/payments/${payment._id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
        }),
      })
      toast.success(`Payment ${newStatus.toLowerCase()} successfully`)
      load() // Reload payments
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update payment')
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // Always filter for pending payments only
      params.append('status', 'Pending')
      if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod)
      if (filters.fromDate) params.append('startDate', filters.fromDate)
      if (filters.toDate) params.append('endDate', filters.toDate)
      
      const data = await apiRequest<Payment[]>(`/payments?${params.toString()}`)
      setItems(data)
    } catch (e: any) {
      toast.error('Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Since we only show pending payments, only show pending count
  const statusCounts = {
    Pending: items.length,
    Approved: 0,
    Hold: 0,
    Rejected: 0,
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      Pending: 'bg-yellow-100 text-yellow-700',
      Approved: 'bg-green-100 text-green-700',
      Hold: 'bg-orange-100 text-orange-700',
      Rejected: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-neutral-100 text-neutral-700'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Payments</h1>
          <p className="text-sm text-neutral-600 mt-1">View and manage pending payment approvals</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/payments/add-payment">
            <Button>Add Payment</Button>
          </Link>
          {isAdmin && (
            <Link href="/dashboard/payments/approval-pending-cash">
              <Button variant="outline">Review Pending</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Summary Card - Only Pending */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4 max-w-md">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Pending Payments</p>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.Pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Status filter removed - only showing pending payments */}
          <Select value={filters.paymentMethod || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, paymentMethod: v === 'all' ? '' : v }))}>
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Filter by Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="NEFT/RTGS">NEFT/RTGS</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label htmlFor="payments-from-date">From Date</Label>
            <Input
              id="payments-from-date"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))}
              className="bg-white text-neutral-900"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payments-to-date">To Date</Label>
            <Input
              id="payments-to-date"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))}
              className="bg-white text-neutral-900"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {/* Payments List */}
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading...</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-center text-neutral-500">No payments found</div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left w-8"></th>
                <th className="py-2 px-3 text-left">School/Customer</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3">Payment Method</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Entered By</th>
                {isAdmin && <th className="py-2 px-3">Reviewed By</th>}
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const hasBreakdown = p.paymentBreakdown && p.paymentBreakdown.length > 0
                const isExpanded = expandedPayments.has(p._id)
                return (
                  <>
                    <tr key={p._id} className="border-b last:border-0 hover:bg-neutral-50">
                      <td className="py-2 px-3">
                        {hasBreakdown && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(p._id)}
                            className="h-6 w-6 p-0"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-medium">{p.customerName || '-'}</div>
                        {p.schoolCode && <div className="text-xs text-neutral-500">{p.schoolCode}</div>}
                        {p.autoCreated && (
                          <div className="text-xs text-blue-600 mt-1">Auto-generated from DC</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">₹{p.amount?.toFixed(2) || '0.00'}</td>
                      <td className="py-2 px-3">{p.paymentMethod || '-'}</td>
                      <td className="py-2 px-3">{getStatusBadge(p.status)}</td>
                      <td className="py-2 px-3">
                        {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-2 px-3">{p.createdBy?.name || '-'}</td>
                      {isAdmin && (
                        <td className="py-2 px-3">
                          {p.approvedBy?.name && <div className="text-green-600 text-xs">✓ {p.approvedBy.name}</div>}
                          {p.heldBy?.name && <div className="text-orange-600 text-xs">⏸ {p.heldBy.name}</div>}
                          {p.rejectedBy?.name && <div className="text-red-600 text-xs">✗ {p.rejectedBy.name}</div>}
                          {!p.approvedBy && !p.heldBy && !p.rejectedBy && '-'}
                        </td>
                      )}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {p.paymentBreakdown && p.paymentBreakdown.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInvoiceView(p)}
                            >
                              <FileText className="w-4 h-4 mr-1" />
                              View Invoice
                            </Button>
                          )}
                          {p.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openUpdatePayment(p)}
                              >
                                Update Payment
                              </Button>
                              {isManager && (
                                <>
                                  {isAdmin && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => router.push(`/dashboard/payments/approval-pending-cash/${p._id}`)}
                                    >
                                      Review
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleUpdatePayment(p, 'Approved')}
                                  >
                                    Complete Payment
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {hasBreakdown && isExpanded && (
                      <tr key={`${p._id}-breakdown`} className="border-b bg-neutral-50">
                        <td colSpan={isAdmin ? 9 : 7} className="py-4 px-4">
                          <div className="space-y-2">
                            <div className="font-semibold text-sm mb-3">Product Breakdown (Invoice):</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-neutral-100 border-b">
                                    <th className="py-2 px-3 text-left">Product</th>
                                    <th className="py-2 px-3 text-left">Class</th>
                                    <th className="py-2 px-3 text-left">Category</th>
                                    <th className="py-2 px-3 text-left">Specs</th>
                                    <th className="py-2 px-3 text-left">Subject</th>
                                    <th className="py-2 px-3 text-right">Quantity</th>
                                    <th className="py-2 px-3 text-right">Strength</th>
                                    <th className="py-2 px-3 text-right">Level</th>
                                    <th className="py-2 px-3 text-right">Unit Price</th>
                                    <th className="py-2 px-3 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.paymentBreakdown?.map((item, idx) => (
                                    <tr key={idx} className="border-b">
                                      <td className="py-2 px-3">{item.product}</td>
                                      <td className="py-2 px-3">{item.class}</td>
                                      <td className="py-2 px-3">{item.category}</td>
                                      <td className="py-2 px-3">{item.specs}</td>
                                      <td className="py-2 px-3">{item.subject || '-'}</td>
                                      <td className="py-2 px-3 text-right">{item.quantity}</td>
                                      <td className="py-2 px-3 text-right">{item.strength}</td>
                                      <td className="py-2 px-3 text-right">{item.level}</td>
                                      <td className="py-2 px-3 text-right">₹{item.unitPrice.toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t-2 border-neutral-400 font-semibold bg-neutral-100">
                                    <td colSpan={9} className="py-2 px-3 text-right">Grand Total:</td>
                                    <td className="py-2 px-3 text-right">₹{p.amount.toFixed(2)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })              }
            </tbody>
          </table>
        )}
      </Card>

      {/* Invoice View Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice - {selectedPaymentForInvoice?.customerName || 'Payment'}</DialogTitle>
            <DialogDescription>
              Product details and costs for this payment
            </DialogDescription>
          </DialogHeader>
          
          {selectedPaymentForInvoice && (
            <div className="space-y-6 py-4">
              {/* Payment Information */}
              <div className="border rounded-lg p-4 bg-neutral-50">
                <h3 className="font-semibold text-lg mb-3">Payment Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600">Customer Name:</span>
                    <span className="ml-2 font-medium">{selectedPaymentForInvoice.customerName || '-'}</span>
                  </div>
                  {selectedPaymentForInvoice.schoolCode && (
                    <div>
                      <span className="text-neutral-600">School Code:</span>
                      <span className="ml-2 font-medium">{selectedPaymentForInvoice.schoolCode}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-neutral-600">Payment Method:</span>
                    <span className="ml-2 font-medium">{selectedPaymentForInvoice.paymentMethod || '-'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Status:</span>
                    <span className="ml-2 font-medium">{selectedPaymentForInvoice.status || '-'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Payment Date:</span>
                    <span className="ml-2 font-medium">
                      {selectedPaymentForInvoice.paymentDate 
                        ? new Date(selectedPaymentForInvoice.paymentDate).toLocaleDateString()
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-600">Total Amount:</span>
                    <span className="ml-2 font-medium text-lg">₹{selectedPaymentForInvoice.amount?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>

              {/* Products Table */}
              {selectedPaymentForInvoice.paymentBreakdown && selectedPaymentForInvoice.paymentBreakdown.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-neutral-100 px-4 py-3 border-b">
                    <h3 className="font-semibold text-lg">Products & Pricing</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-50 border-b">
                          <th className="py-3 px-4 text-left font-semibold">Product</th>
                          <th className="py-3 px-4 text-left font-semibold">Term</th>
                          <th className="py-3 px-4 text-left font-semibold">Class</th>
                          <th className="py-3 px-4 text-left font-semibold">Category</th>
                          <th className="py-3 px-4 text-left font-semibold">Specs</th>
                          <th className="py-3 px-4 text-left font-semibold">Subject</th>
                          <th className="py-3 px-4 text-right font-semibold">Quantity</th>
                          <th className="py-3 px-4 text-right font-semibold">Strength</th>
                          <th className="py-3 px-4 text-right font-semibold">Level</th>
                          <th className="py-3 px-4 text-right font-semibold">Unit Price</th>
                          <th className="py-3 px-4 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPaymentForInvoice.paymentBreakdown.map((item, idx) => (
                          <tr key={idx} className="border-b hover:bg-neutral-50">
                            <td className="py-3 px-4 font-medium">{item.product}</td>
                            <td className="py-3 px-4">{item.term || 'Term 1'}</td>
                            <td className="py-3 px-4">{item.class}</td>
                            <td className="py-3 px-4">{item.category}</td>
                            <td className="py-3 px-4">{item.specs}</td>
                            <td className="py-3 px-4">{item.subject || '-'}</td>
                            <td className="py-3 px-4 text-right">{item.quantity}</td>
                            <td className="py-3 px-4 text-right">{item.strength}</td>
                            <td className="py-3 px-4 text-right">{item.level}</td>
                            <td className="py-3 px-4 text-right">₹{item.unitPrice.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                        <tr className="bg-neutral-100 border-t-2 border-neutral-400 font-bold">
                          <td colSpan={10} className="py-4 px-4 text-right">
                            Grand Total:
                          </td>
                          <td className="py-4 px-4 text-right text-lg">
                            ₹{selectedPaymentForInvoice.paymentBreakdown.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Payment Modal */}
      <Dialog open={updatePaymentModalOpen} onOpenChange={setUpdatePaymentModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Payment - {selectedPaymentForUpdate?.customerName || 'Payment'}</DialogTitle>
            <DialogDescription>
              Update payment details when payment is received
            </DialogDescription>
          </DialogHeader>
          
          {selectedPaymentForUpdate && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Method *</label>
                  <Select
                    value={updateFormData.paymentMethod}
                    onValueChange={(value) => setUpdateFormData({ ...updateFormData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="NEFT/RTGS">NEFT/RTGS</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Debit Card">Debit Card</SelectItem>
                      <SelectItem value="Online Payment">Online Payment</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Date *</label>
                  <Input
                    type="date"
                    value={updateFormData.paymentDate}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, paymentDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Reference Number</label>
                <Input
                  value={updateFormData.referenceNumber}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, referenceNumber: e.target.value })}
                  placeholder="Enter reference number"
                />
              </div>

              {/* UPI Fields */}
              {updateFormData.paymentMethod === 'UPI' && (
                <div>
                  <label className="text-sm font-medium mb-1 block">UPI ID</label>
                  <Input
                    value={updateFormData.upiId}
                    onChange={(e) => setUpdateFormData({ ...updateFormData, upiId: e.target.value })}
                    placeholder="Enter UPI ID"
                  />
                </div>
              )}

              {/* NEFT/RTGS Fields */}
              {updateFormData.paymentMethod === 'NEFT/RTGS' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Transaction ID</label>
                    <Input
                      value={updateFormData.transactionId}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, transactionId: e.target.value })}
                      placeholder="Enter transaction ID"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Bank Name</label>
                      <Input
                        value={updateFormData.bankName}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, bankName: e.target.value })}
                        placeholder="Enter bank name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">IFSC Code</label>
                      <Input
                        value={updateFormData.ifscCode}
                        onChange={(e) => setUpdateFormData({ ...updateFormData, ifscCode: e.target.value })}
                        placeholder="Enter IFSC code"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cheque Fields */}
              {updateFormData.paymentMethod === 'Cheque' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cheque Number</label>
                    <Input
                      value={updateFormData.chequeNumber}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, chequeNumber: e.target.value })}
                      placeholder="Enter cheque number"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Bank Name</label>
                    <Input
                      value={updateFormData.bankName}
                      onChange={(e) => setUpdateFormData({ ...updateFormData, bankName: e.target.value })}
                      placeholder="Enter bank name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Remarks/Description</label>
                <Input
                  value={updateFormData.description}
                  onChange={(e) => setUpdateFormData({ ...updateFormData, description: e.target.value })}
                  placeholder="Enter any remarks"
                />
              </div>

              <div className="border-t pt-4">
                <div className="text-sm text-neutral-600">
                  <div><strong>Customer:</strong> {selectedPaymentForUpdate.customerName}</div>
                  <div><strong>Amount:</strong> ₹{selectedPaymentForUpdate.amount?.toFixed(2) || '0.00'}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdatePaymentModalOpen(false)} disabled={updatingPayment}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdatePaymentDetails} 
              disabled={updatingPayment || !updateFormData.paymentMethod || !updateFormData.paymentDate}
            >
              {updatingPayment ? 'Updating...' : 'Update Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


