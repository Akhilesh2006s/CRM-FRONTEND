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
import { CheckCircle2, Clock, XCircle, Pause, CreditCard, TrendingUp } from 'lucide-react'
import Link from 'next/link'

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
}

export default function PaymentsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'Finance Manager' || currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
  
  const [items, setItems] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    paymentMethod: '',
    fromDate: '',
    toDate: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
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

  const statusCounts = {
    Pending: items.filter(p => p.status === 'Pending').length,
    Approved: items.filter(p => p.status === 'Approved').length,
    Hold: items.filter(p => p.status === 'Hold').length,
    Rejected: items.filter(p => p.status === 'Rejected').length,
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
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Payments</h1>
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

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.Pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{statusCounts.Approved}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Hold</p>
              <p className="text-2xl font-bold text-orange-600">{statusCounts.Hold}</p>
            </div>
            <Pause className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{statusCounts.Rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); load() }} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
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
          <Input
            type="date"
            placeholder="From Date"
            value={filters.fromDate}
            onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))}
            className="bg-white text-neutral-900"
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.toDate}
            onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))}
            className="bg-white text-neutral-900"
          />
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
                <th className="py-2 px-3 text-left">School/Customer</th>
                <th className="py-2 px-3 text-right">Amount</th>
                <th className="py-2 px-3">Payment Method</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Entered By</th>
                {isAdmin && <th className="py-2 px-3">Reviewed By</th>}
                {isAdmin && <th className="py-2 px-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="py-2 px-3">
                    <div className="font-medium">{p.customerName || '-'}</div>
                    {p.schoolCode && <div className="text-xs text-neutral-500">{p.schoolCode}</div>}
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
                  {isAdmin && (
                    <td className="py-2 px-3 text-right">
                      {p.status === 'Pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/dashboard/payments/approval-pending-cash/${p._id}`)}
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}


