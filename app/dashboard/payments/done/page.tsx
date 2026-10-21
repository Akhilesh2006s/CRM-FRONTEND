'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { getCurrentUser } from '@/lib/auth'
import { CheckCircle2, Clock, XCircle, Pause, Search } from 'lucide-react'

type Payment = {
  _id: string
  customerName: string
  schoolCode?: string
  amount: number
  paymentMethod: string
  status: 'Pending' | 'Approved' | 'Hold' | 'Rejected'
  paymentDate: string
  financialYear?: string
  referenceNumber?: string
  refNo?: string
  description?: string
  upiId?: string
  transactionId?: string
  chequeNumber?: string
  bankName?: string
  accountNumber?: string
  ifscCode?: string
  cardLast4?: string
  paymentGateway?: string
  otherDetails?: string
  chqDate?: string
  txnNo?: string
  approvedAt?: string
  rejectedAt?: string
  heldAt?: string
  approvedBy?: { name?: string; email?: string }
  rejectedBy?: { name?: string; email?: string }
  heldBy?: { name?: string; email?: string }
}

const STATUS_COLORS = {
  Pending: 'text-yellow-600 bg-yellow-50',
  Approved: 'text-green-600 bg-green-50',
  Hold: 'text-orange-600 bg-orange-50',
  Rejected: 'text-red-600 bg-red-50',
}

const STATUS_ICONS = {
  Pending: Clock,
  Approved: CheckCircle2,
  Hold: Pause,
  Rejected: XCircle,
}

type SchoolBalance = { schoolCode: string; schoolName: string; total: number; paid: number; balance: number }

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`

export default function PaymentsDonePage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [balances, setBalances] = useState<SchoolBalance[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all')

  useEffect(() => {
    loadPayments()
  }, [])

  useEffect(() => {
    filterPayments()
  }, [payments, searchTerm, statusFilter, paymentMethodFilter])

  async function loadPayments() {
    try {
      setLoading(true)
      const currentUser = getCurrentUser()
      if (!currentUser || !currentUser._id) {
        toast.error('User not found. Please login again.')
        setLoading(false)
        return
      }

      // Every status, so the BDE sees payments that were held or rejected (with the reason).
      const isBde = ['Executive', 'Sales BDE', 'Employee'].includes(String(currentUser.role || ''))
      const data = await apiRequest<Payment[]>(isBde ? `/payments?createdBy=${currentUser._id}` : `/payments`)
      setPayments(data || [])
      // Order total vs approved payments per school (own schools for a BDE).
      apiRequest<SchoolBalance[]>('/payments/school-balances')
        .then((rows) => setBalances(Array.isArray(rows) ? rows : []))
        .catch(() => setBalances([]))
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load payments')
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  function filterPayments() {
    let filtered = statusFilter === 'all' ? [...payments] : payments.filter((p) => p.status === statusFilter)

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.customerName?.toLowerCase().includes(term) ||
          p.schoolCode?.toLowerCase().includes(term) ||
          p.paymentMethod?.toLowerCase().includes(term) ||
          p.referenceNumber?.toLowerCase().includes(term) ||
          p.refNo?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      )
    }

    // Status filter - only approved (already filtered above)
    // No need to filter again since we only load approved payments

    // Payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter((p) => p.paymentMethod === paymentMethodFilter)
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.paymentDate).getTime()
      const dateB = new Date(b.paymentDate).getTime()
      return dateB - dateA
    })

    setFilteredPayments(filtered)
  }

  function getPaymentDetails(payment: Payment): string {
    if (payment.paymentMethod === 'UPI' && payment.upiId) {
      return `UPI ID: ${payment.upiId}`
    }
    if (payment.paymentMethod === 'NEFT/RTGS' && payment.transactionId) {
      return `Txn ID: ${payment.transactionId}${payment.ifscCode ? ` | IFSC: ${payment.ifscCode}` : ''}`
    }
    if (payment.paymentMethod === 'Cheque' && payment.chequeNumber) {
      return `Cheque No: ${payment.chequeNumber}${payment.bankName ? ` | Bank: ${payment.bankName}` : ''}`
    }
    if (payment.paymentMethod === 'Bank Transfer' && payment.transactionId) {
      return `Txn ID: ${payment.transactionId}${payment.bankName ? ` | Bank: ${payment.bankName}` : ''}`
    }
    if ((payment.paymentMethod === 'Credit Card' || payment.paymentMethod === 'Debit Card') && payment.cardLast4) {
      return `Card: ****${payment.cardLast4}${payment.bankName ? ` | ${payment.bankName}` : ''}`
    }
    if (payment.paymentMethod === 'Online Payment' && payment.transactionId) {
      return `Txn ID: ${payment.transactionId}${payment.paymentGateway ? ` | Gateway: ${payment.paymentGateway}` : ''}`
    }
    if (payment.paymentMethod === 'Other' && payment.otherDetails) {
      return payment.otherDetails
    }
    if (payment.referenceNumber) {
      return `Ref: ${payment.referenceNumber}`
    }
    if (payment.refNo) {
      return `Ref: ${payment.refNo}`
    }
    return '-'
  }

  function getStatusBadge(payment: Payment) {
    const StatusIcon = STATUS_ICONS[payment.status] || Clock
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}
      >
        <StatusIcon className="w-3.5 h-3.5" />
        {payment.status}
      </span>
    )
  }

  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const approvedAmount = filteredPayments
    .filter((p) => p.status === 'Approved')
    .reduce((sum, p) => sum + (p.amount || 0), 0)
  const pendingAmount = filteredPayments
    .filter((p) => p.status === 'Pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Payments Done</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-neutral-600 mb-1">Total Payments</div>
          <div className="text-2xl font-semibold text-neutral-900">{filteredPayments.length}</div>
          <div className="text-sm text-neutral-500 mt-1">₹{totalAmount.toLocaleString('en-IN')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-neutral-600 mb-1">Approved</div>
          <div className="text-2xl font-semibold text-green-600">
            {filteredPayments.filter((p) => p.status === 'Approved').length}
          </div>
          <div className="text-sm text-neutral-500 mt-1">₹{approvedAmount.toLocaleString('en-IN')}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-neutral-600 mb-1">Pending</div>
          <div className="text-2xl font-semibold text-yellow-600">
            {filteredPayments.filter((p) => p.status === 'Pending').length}
          </div>
          <div className="text-sm text-neutral-500 mt-1">₹{pendingAmount.toLocaleString('en-IN')}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Search by school, code, method, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white text-neutral-900"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Hold">Hold</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
            <SelectTrigger className="bg-white text-neutral-900">
              <SelectValue placeholder="Filter by Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
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
      </Card>

      {balances.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">School Balances</h2>
          <p className="text-xs text-neutral-500 mb-3">Order total, approved payments and what is still due for each school.</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School Name</TableHead>
                  <TableHead>School Code</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances
                  .filter((b) => {
                    const q = searchTerm.trim().toLowerCase()
                    return !q || b.schoolName.toLowerCase().includes(q) || b.schoolCode.toLowerCase().includes(q)
                  })
                  .map((b) => (
                    <TableRow key={b.schoolCode}>
                      <TableCell className="font-medium">{b.schoolName || '-'}</TableCell>
                      <TableCell>{b.schoolCode}</TableCell>
                      <TableCell className="text-right">{inr(b.total)}</TableCell>
                      <TableCell className="text-right text-green-700">{inr(b.paid)}</TableCell>
                      <TableCell className={`text-right font-semibold ${b.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {inr(b.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">No payments found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead>School Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Payment Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financial Year</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell>
                      {payment.paymentDate
                        ? new Date(payment.paymentDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{payment.customerName || '-'}</TableCell>
                    <TableCell>{payment.schoolCode || '-'}</TableCell>
                    <TableCell className="font-semibold">₹{payment.amount?.toLocaleString('en-IN') || '0'}</TableCell>
                    <TableCell>{payment.paymentMethod || '-'}</TableCell>
                    <TableCell className="text-sm text-neutral-600 max-w-xs truncate">
                      {getPaymentDetails(payment)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment)}</TableCell>
                    <TableCell>{payment.financialYear || '-'}</TableCell>
                    <TableCell
                      className="text-sm text-neutral-600 max-w-xs truncate"
                      title={(payment as any).rejectionReason || (payment as any).adminRemarks || payment.description || ''}
                    >
                      {payment.status === 'Rejected' || payment.status === 'Hold'
                        ? (payment as any).rejectionReason || (payment as any).adminRemarks || payment.description || '-'
                        : payment.description || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

