'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ExternalLink, FileText } from 'lucide-react'

type Person = {
  _id: string
  name: string
  email?: string
  empCode?: string
  role?: string
}

type Expense = {
  _id: string
  title: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  category: string
  status: string
  description?: string
  employeeRemarks?: string
  managerRemarks?: string
  date: string
  gpsDistance?: number
  /** Distance tracked by the employee's device (LocationPing) on the expense date */
  trackedDistanceKm?: number
  expItemId?: string
  receipt?: string
  ticketReceipt?: string
  transportType?: string
  travelFrom?: string
  travelTo?: string
  approxKms?: number
  employeeId?: Person | null
  trainerId?: Person | null
  createdBy?: Person | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: Person | null
}

type SortKey = 'expItemId' | 'category' | 'gps' | 'date' | 'amount'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i

const isTravel = (expense: Expense) => expense.category?.toLowerCase() === 'travel'

const claimedAmount = (expense: Expense) => expense.employeeAmount ?? expense.amount

const itemId = (expense: Expense) => expense.expItemId || expense._id.slice(-5)

// Legacy format: "90 Kms Tadepalligudem to Bhimavaram / By Bike"
const describe = (expense: Expense) => {
  if (expense.description?.trim()) return expense.description
  if (isTravel(expense) && (expense.travelFrom || expense.travelTo)) {
    const kms = expense.approxKms ? `${expense.approxKms} Kms ` : ''
    const mode = expense.transportType ? ` / By ${expense.transportType}` : ''
    return `${kms}${expense.travelFrom || '?'} to ${expense.travelTo || '?'}${mode}`
  }
  return expense.title || ''
}

const gpsKm = (expense: Expense) => expense.trackedDistanceKm ?? 0

const statusLabel = (status: string) => {
  if (status === 'Pending') return 'Pending at Zonal Manager'
  if (status === 'Executive Manager Approved') return 'Pending at Product Manager'
  return status
}

const pageTitle = (role: string) => {
  if (role === 'Manager') return 'Product Manager Expense Update'
  if (role === 'Executive Manager') return 'Zonal Manager Expense Update'
  return 'Expense Review & Approval'
}

function BillLink({ label, url }: { label: string; url?: string }) {
  const href = resolveUploadUrl(url)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-col items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
      title={`Open ${label}`}
    >
      {IMAGE_EXT.test(href) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt={label} className="h-14 w-14 rounded border border-neutral-200 object-cover" />
      ) : (
        <FileText className="h-8 w-8" />
      )}
      <span className="inline-flex items-center gap-0.5">
        {label}
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  )
}

export default function ManagerExpenseUpdatePage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.employeeId as string

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [employee, setEmployee] = useState<Person | null>(null)
  const [role, setRole] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'asc' })

  // Form state for each expense
  const [expenseForms, setExpenseForms] = useState<Record<string, {
    approvedAmount: string
    managerRemarks: string
  }>>({})

  useEffect(() => {
    setRole(getCurrentUser()?.role || '')
  }, [])

  useEffect(() => {
    if (employeeId) {
      loadExpenses()
    }
  }, [employeeId, fromDate, toDate])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)

      const data = (await apiRequest<Expense[]>(`/expenses/employee/${employeeId}${params.toString() ? `?${params.toString()}` : ''}`)) || []

      setExpenses(data)

      // Initialize form state
      const initialForms: Record<string, { approvedAmount: string; managerRemarks: string }> = {}
      data.forEach(exp => {
        initialForms[exp._id] = {
          approvedAmount: String(exp.approvedAmount ?? claimedAmount(exp)),
          managerRemarks: exp.managerRemarks || '',
        }
      })
      setExpenseForms(initialForms)

      if (data.length > 0) {
        const first = data[0]
        setEmployee(first.employee || first.employeeId || first.trainerId || first.createdBy || null)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadExpenses()
  }

  const handleFormChange = (expenseId: string, field: 'approvedAmount' | 'managerRemarks', value: string) => {
    setExpenseForms(prev => ({
      ...prev,
      [expenseId]: {
        ...prev[expenseId],
        [field]: value,
      }
    }))
  }

  const parsedApproved = (expense: Expense) => {
    const raw = expenseForms[expense._id]?.approvedAmount
    if (raw === undefined || raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : NaN
  }

  const handleApprove = async () => {
    if (expenses.length === 0) {
      toast.error('No expenses to approve')
      return
    }

    const invalid = expenses.find((exp) => {
      const n = parsedApproved(exp)
      return n === null || Number.isNaN(n) || n < 0
    })
    if (invalid) {
      toast.error(`Enter a valid approval amount for item ${itemId(invalid)}`)
      return
    }

    setSubmitting(true)
    try {
      const expensesToApprove = expenses.map(exp => ({
        id: exp._id,
        approvedAmount: parsedApproved(exp),
        managerRemarks: expenseForms[exp._id]?.managerRemarks || '',
      }))

      const res = await apiRequest<{ message: string }>('/expenses/approve-multiple', {
        method: 'POST',
        body: JSON.stringify({ expenses: expensesToApprove }),
      })

      toast.success(res?.message || `${expenses.length} expense(s) approved successfully`)
      router.push('/dashboard/expenses/pending')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve expenses')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getExpenseType = (category: string) => {
    if (!category) return '-'
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  const sortedExpenses = useMemo(() => {
    const value = (e: Expense): string | number => {
      switch (sort.key) {
        case 'expItemId': return itemId(e)
        case 'category': return e.category || ''
        case 'gps': return isTravel(e) ? gpsKm(e) : -1
        case 'amount': return claimedAmount(e)
        case 'date': return new Date(e.date).getTime() || 0
      }
    }
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...expenses].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va < vb) return -dir
      if (va > vb) return dir
      return 0
    })
  }, [expenses, sort])

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  const SortHead = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <TableHead className={`font-semibold ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-neutral-900">
        {label}
        {sort.key !== k ? (
          <ArrowUpDown className="h-3 w-3 text-neutral-400" />
        ) : sort.dir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )}
      </button>
    </TableHead>
  )

  const totalClaimed = expenses.reduce((sum, exp) => sum + claimedAmount(exp), 0)

  const totalApproved = expenses.reduce((sum, exp) => {
    const n = parsedApproved(exp)
    return sum + (n === null || Number.isNaN(n) ? 0 : n)
  }, 0)

  // The tracked figure is per day, so count each travel day once.
  const totalGpsDistance = [...new Map(
    expenses.filter(isTravel).map((exp) => [new Date(exp.date).toDateString(), gpsKm(exp)] as const)
  ).values()].reduce((sum, km) => sum + km, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/expenses/pending')} aria-label="Back to pending expenses">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{pageTitle(role)}</h1>
      </div>

      {/* Date Filters */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="fromDate" className="whitespace-nowrap">From Date:</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-[180px] bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="toDate" className="whitespace-nowrap">To Date:</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-[180px] bg-white"
            />
          </div>
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
            Search
          </Button>
        </div>
      </Card>

      {/* Employee Info */}
      <Card className="p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <span className="text-neutral-600 font-medium">Manager Expense Update</span>
            <Button variant="outline" className="bg-white" asChild>
              <Link href="/dashboard/reports/employee-track">View Employee Track</Link>
            </Button>
          </div>
          <div className="text-lg font-semibold text-neutral-900">
            Employee:{' '}
            <span className="text-blue-600">
              {loading ? 'Loading...' : employee?.name || '-'}
            </span>
            {employee?.empCode && <span className="text-neutral-500 text-sm font-normal"> ({employee.empCode})</span>}
            {employee?.role && <span className="text-neutral-500 text-sm font-normal"> · {employee.role}</span>}
          </div>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <SortHead k="expItemId" label="Exp Item ID" />
                <SortHead k="category" label="Expense Type" />
                <SortHead k="gps" label="GPS Dist" />
                <TableHead className="font-semibold">Description</TableHead>
                <SortHead k="date" label="Date of Expense" />
                <SortHead k="amount" label="Amount" className="text-right" />
                <TableHead className="font-semibold">Emp.Remarks</TableHead>
                <TableHead className="font-semibold">Approval Amount</TableHead>
                <TableHead className="font-semibold">Mngr.Remarks</TableHead>
                <TableHead className="font-semibold">Bill Image</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-neutral-500">
                    No expenses awaiting your approval for this employee
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedExpenses.map((expense, index) => {
                    const approved = parsedApproved(expense)
                    const edited = approved !== null && !Number.isNaN(approved) && approved !== claimedAmount(expense)
                    return (
                      <TableRow
                        key={expense._id}
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{itemId(expense)}</TableCell>
                        <TableCell>
                          <div>{getExpenseType(expense.category)}</div>
                          <div className="text-[11px] text-neutral-500 whitespace-nowrap">{statusLabel(expense.status)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-red-600">
                          {isTravel(expense) ? `${gpsKm(expense)} Kms` : <span className="text-neutral-400">-</span>}
                        </TableCell>
                        <TableCell className="min-w-[200px] max-w-xs">
                          <Textarea
                            value={describe(expense)}
                            readOnly
                            className="min-h-[60px] resize-none bg-neutral-50 text-sm border-0"
                            rows={2}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(expense.date)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {claimedAmount(expense).toFixed(2)}
                        </TableCell>
                        <TableCell className="min-w-[160px] max-w-xs">
                          <Textarea
                            value={expense.employeeRemarks || ''}
                            readOnly
                            className="min-h-[60px] resize-none bg-neutral-50 text-sm border-0"
                            rows={2}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={expenseForms[expense._id]?.approvedAmount ?? ''}
                            onChange={(e) => handleFormChange(expense._id, 'approvedAmount', e.target.value)}
                            className={`w-32 bg-white text-sm font-medium ${edited ? 'border-orange-400 text-orange-700' : ''}`}
                            placeholder="Approved Amount"
                            aria-label={`Approval amount for item ${itemId(expense)}`}
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px] max-w-xs">
                          <Textarea
                            value={expenseForms[expense._id]?.managerRemarks || ''}
                            onChange={(e) => handleFormChange(expense._id, 'managerRemarks', e.target.value)}
                            placeholder="Manager Remarks"
                            className="min-h-[60px] resize-none bg-white text-sm"
                            rows={2}
                          />
                        </TableCell>
                        <TableCell>
                          {expense.receipt || expense.ticketReceipt ? (
                            <div className="flex gap-2">
                              <BillLink label="Image 1" url={expense.receipt} />
                              <BillLink label="Ticket" url={expense.ticketReceipt} />
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Total Row */}
                  <TableRow className="bg-neutral-100 font-semibold">
                    <TableCell colSpan={3} className="text-right">
                      Total:
                    </TableCell>
                    <TableCell className="text-red-600 whitespace-nowrap">
                      {totalGpsDistance.toFixed(2)} Kms
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      Rs. {totalClaimed.toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="whitespace-nowrap">
                      Rs. {totalApproved.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Info */}
        {expenses.length > 0 && (
          <div className="px-4 py-2 text-sm text-neutral-600 border-t">
            Showing 1 to {expenses.length} of {expenses.length} entries
          </div>
        )}
      </Card>

      {/* Approve Button */}
      {expenses.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-neutral-600">
            Approving {expenses.length} item(s) for Rs. {totalApproved.toFixed(2)}
            {totalApproved !== totalClaimed && ` (claimed Rs. ${totalClaimed.toFixed(2)})`}
          </p>
          <Button
            onClick={handleApprove}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
          >
            {submitting ? 'Approving...' : 'Approve'}
          </Button>
        </div>
      )}
    </div>
  )
}
