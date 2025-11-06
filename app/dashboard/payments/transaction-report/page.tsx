'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { toast } from 'sonner'

type PaymentRow = {
  _id: string
  schoolCode?: string
  customerName: string
  contactName?: string
  mobileNumber?: string
  avgStrength?: number
  location?: string
  amount: number
  refNo?: string
  referenceNumber?: string
  paymentMethod: string
  financialYear?: string
  paymentDate: string
  status: string
}

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other']
const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected']

export default function PaymentsTransactionReport() {
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    schoolCode: '',
    schoolName: '',
    mobileNo: '',
    paymentMode: '',
    zone: '',
    employee: '',
    status: '',
    fromDate: '',
    toDate: '',
  })

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) {
        if (k === 'fromDate') qs.append('startDate', v)
        else if (k === 'toDate') qs.append('endDate', v)
        else if (k === 'paymentMode') qs.append('paymentMode', v)
        else if (k === 'mobileNo') qs.append('mobileNo', v)
        else qs.append(k, v)
      }
    })
    try {
      const data = await apiRequest<PaymentRow[]>(`/payments?${qs.toString()}`)
      setRows(data)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleExport() {
    try {
      const qs = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v) {
          if (k === 'fromDate') qs.append('startDate', v)
          else if (k === 'toDate') qs.append('endDate', v)
          else if (k === 'paymentMode') qs.append('paymentMode', v)
          else if (k === 'mobileNo') qs.append('mobileNo', v)
          else qs.append(k, v)
        }
      })

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(`${API_BASE_URL}/api/payments/export?${qs.toString()}`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Export failed' }))
        throw new Error(error.message || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Payments_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel file downloaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export to Excel')
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Payments Report</h1>

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
          <select
            className="w-full border rounded px-2 py-2 bg-neutral-900 text-white"
            value={filters.paymentMode}
            onChange={(e) => setFilters({ ...filters, paymentMode: e.target.value })}
          >
            <option value="">Select Payment Mode</option>
            {PAYMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Input
            placeholder="Select Zone"
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          />
          <Input
            placeholder="Select Employee"
            value={filters.employee}
            onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
          />
          <select
            className="w-full border rounded px-2 py-2 bg-neutral-900 text-white"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Select Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
        </div>
        <div className="mt-3 flex gap-3">
          <Button onClick={load}>Search</Button>
          <Button variant="secondary" onClick={handleExport}>
            Export to Excel
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">S.No</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>Contact Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Avg Strength</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Ref No</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead>Payment Fin Year</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-neutral-500">
                    No payments found
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
                  <TableCell className="whitespace-nowrap">{r.avgStrength || '-'}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{r.location || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.amount?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.refNo || r.referenceNumber || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.paymentMethod || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.financialYear || '-'}</TableCell>
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
                  <TableCell className="whitespace-nowrap">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        r.status === 'Approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {r.status || 'Pending'}
                    </span>
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
