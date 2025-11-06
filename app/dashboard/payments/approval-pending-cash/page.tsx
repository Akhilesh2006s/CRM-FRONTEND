'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PaymentRow = {
  _id: string
  schoolCode?: string
  customerName: string
  contactName?: string
  mobileNumber?: string
  location?: string
  paymentDate: string
  createdBy?: {
    name?: string
    email?: string
  }
  amount: number
  paymentMethod: string
  financialYear?: string
  chqDate?: string
  refNo?: string
  submissionNo?: string
  handoverRemarks?: string
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other']

export default function ApprovalPendingCashPage() {
  const router = useRouter()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    schoolCode: '',
    schoolName: '',
    mobileNo: '',
    paymentMode: 'Cash', // Default to Cash
    executive: '',
    zone: '',
    fromDate: '',
    toDate: '',
  })

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    // Always filter for Pending status and Cash payment mode
    qs.append('status', 'Pending')
    qs.append('paymentMode', filters.paymentMode || 'Cash')
    
    Object.entries(filters).forEach(([k, v]) => {
      if (v && k !== 'paymentMode') {
        if (k === 'fromDate') qs.append('startDate', v)
        else if (k === 'toDate') qs.append('endDate', v)
        else if (k === 'mobileNo') qs.append('mobileNo', v)
        else if (k === 'executive') qs.append('employee', v)
        else qs.append(k, v)
      }
    })
    
    try {
      const data = await apiRequest<PaymentRow[]>(`/payments?${qs.toString()}`)
      setRows(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load pending cash payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function handleEdit(id: string) {
    router.push(`/dashboard/payments/approval-pending-cash/${id}`)
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Pending Payments</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Input
            placeholder="By School Code"
            value={filters.schoolCode}
            onChange={(e) => setFilters({ ...filters, schoolCode: e.target.value })}
          />
          <Input
            placeholder="By School Name"
            value={filters.schoolName}
            onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })}
          />
          <Input
            placeholder="By Mobile No"
            value={filters.mobileNo}
            onChange={(e) => setFilters({ ...filters, mobileNo: e.target.value })}
          />
          <Input
            type="date"
            placeholder="From Date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
          <select
            className="w-full border rounded px-2 py-2 bg-neutral-900 text-white"
            value={filters.paymentMode}
            onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
          >
            <option value="Cash">Cash</option>
            {PAYMENT_MODES.filter((m) => m !== 'Cash').map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Input
            placeholder="Select Executive"
            value={filters.executive}
            onChange={(e) => setFilters({ ...filters, executive: e.target.value })}
          />
          <Input
            placeholder="Select Zone"
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <Button onClick={load}>Search</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <Table className="min-w-[1800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">S.No</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>Contact Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date of Pay</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead>Payment Fin Year</TableHead>
                <TableHead>Chq Date</TableHead>
                <TableHead>Submission No</TableHead>
                <TableHead>Handover Remarks</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} className="text-center text-neutral-500">
                    No pending cash payments found
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow key={r._id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolCode || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customerName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.contactName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.mobileNumber || '-'}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{r.location || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.paymentDate
                      ? new Date(r.paymentDate).toLocaleString('en-GB', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.createdBy?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.amount?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.paymentMethod || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.financialYear || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.chqDate ? new Date(r.chqDate).toLocaleDateString('en-GB') : '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.submissionNo || r.refNo || '-'}</TableCell>
                  <TableCell className="truncate max-w-[150px]">{r.handoverRemarks || '-'}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(r._id)}
                      className="text-orange-600 border-orange-600 hover:bg-orange-50"
                    >
                      <Pencil size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
