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
import { apiRequest } from '@/lib/api'
import { ExpenseBillButton } from '@/components/expenses/ExpenseBillViewer'
import { getCurrentUser } from '@/lib/auth'
import {
  type ApprovalExpense,
  type ExpensePerson,
  expenseStage,
  expenseStatusText,
  firstLevelAmount,
  firstLevelApprovedBy,
} from '@/lib/expenseApproval'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown } from 'lucide-react'

type Expense = ApprovalExpense & {
  _id: string
  title: string
  amount: number
  category: string
  description?: string
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
  employeeId?: ExpensePerson | null
  trainerId?: ExpensePerson | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: ExpensePerson | null
}

type Decision = 'approve' | 'reject'

type ItemForm = {
  decision: Decision
  approvedAmount: string
  remarks: string
}

type SortKey = 'expItemId' | 'category' | 'gps' | 'date' | 'amount'

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

const pageTitle = (role: string) => {
  if (role === 'Finance Manager') return 'Finance Expense Approval'
  if (role === 'Executive Manager') return 'Zonal Manager Expense Update'
  return 'Expense Review & Approval'
}

/** Bill / ticket, opened in the in-app viewer. */
function BillLink({ label, url }: { label: string; url?: string }) {
  return <ExpenseBillButton label={label} url={url} />
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
  const [employee, setEmployee] = useState<ExpensePerson | null>(null)
  const [role, setRole] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'asc' })
  const [forms, setForms] = useState<Record<string, ItemForm>>({})

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

      // Finance starts from the first-level amount; first level starts from the claim.
      const initial: Record<string, ItemForm> = {}
      data.forEach((exp) => {
        const start = expenseStage(exp) === 'finance' ? firstLevelAmount(exp) ?? claimedAmount(exp) : claimedAmount(exp)
        initial[exp._id] = { decision: 'approve', approvedAmount: String(start), remarks: '' }
      })
      setForms(initial)

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

  const setForm = (expenseId: string, patch: Partial<ItemForm>) => {
    setForms((prev) => ({ ...prev, [expenseId]: { ...prev[expenseId], ...patch } }))
  }

  const parsedAmount = (expense: Expense) => {
    const raw = forms[expense._id]?.approvedAmount
    if (raw === undefined || raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : NaN
  }


  /** Why this item's decision cannot be submitted, or null. */
  const itemError = (expense: Expense): string | null => {
    const form = forms[expense._id]
    if (!form) return 'missing form'
    if (form.decision === 'approve') {
      const n = parsedAmount(expense)
      if (n === null || Number.isNaN(n) || n < 0) return 'enter a valid approval amount'
      if (Math.abs(n - startingAmount(expense)) > 0.001 && !form.remarks.trim()) return 'remarks are required when you change the amount'
    }
    return null
  }

  /** The amount the reviewer starts from: the claim at first level, the first-level amount at Finance. */
  function startingAmount(expense: Expense): number {
    return expenseStage(expense) === 'finance' ? firstLevelAmount(expense) ?? claimedAmount(expense) : claimedAmount(expense)
  }

  const handleSubmit = async () => {
    if (expenses.length === 0) {
      toast.error('No expenses to approve')
      return
    }

    const invalid = sortedExpenses.find((exp) => itemError(exp))
    if (invalid) {
      toast.error(`Item ${itemId(invalid)}: ${itemError(invalid)}`)
      return
    }

    setSubmitting(true)
    try {
      const payload = expenses.map((exp) => {
        const form = forms[exp._id]
        return {
          id: exp._id,
          action: form.decision,
          approvedAmount: form.decision === 'approve' ? parsedAmount(exp) : undefined,
          remarks: form.remarks.trim(),
        }
      })

      const res = await apiRequest<{ message: string; failed?: { id: string; message: string }[] }>(
        '/expenses/approve-multiple',
        { method: 'POST', body: JSON.stringify({ expenses: payload }) }
      )

      if (res?.failed?.length) {
        toast.warning(`${res.message}. ${res.failed[0].message}`)
        loadExpenses()
        return
      }
      toast.success(res?.message || 'Expenses updated')
      router.push(listPath)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update expenses')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
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

  const approving = expenses.filter((exp) => forms[exp._id]?.decision !== 'reject')
  const rejectingCount = expenses.length - approving.length
  const totalApproved = approving.reduce((sum, exp) => {
    const n = parsedAmount(exp)
    return sum + (n === null || Number.isNaN(n) ? 0 : n)
  }, 0)

  // The tracked figure is per day, so count each travel day once.
  const totalGpsDistance = [...new Map(
    expenses.filter(isTravel).map((exp) => [new Date(exp.date).toDateString(), gpsKm(exp)] as const)
  ).values()].reduce((sum, km) => sum + km, 0)

  const hasFinanceItems = expenses.some((exp) => expenseStage(exp) === 'finance')
  // After acting, a Zonal Manager lands on the list that shows each expense's new status.
  const listPath = role === 'Executive Manager'
    ? '/dashboard/expenses/executive-manager-pending?tab=decided'
    : '/dashboard/expenses/pending'
  const totalClaimedKm = expenses.filter(isTravel).reduce((sum, exp) => sum + (Number(exp.approxKms) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(role === 'Executive Manager' ? '/dashboard/expenses/executive-manager-pending' : '/dashboard/expenses/pending')} aria-label="Back to pending expenses">
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
          <Button onClick={loadExpenses} className="bg-blue-600 hover:bg-blue-700 text-white">
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
              <Link href={`/dashboard/reports/employee-track${employee?.name ? `?search=${encodeURIComponent(employee.name)}` : ''}`}>
                View Employee Track
              </Link>
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
        <p className="text-xs text-neutral-500 mt-3">
          Approving needs an approved amount (first level) or the final amount (Finance). Remarks are required only when you change the amount.
          Either level can reject an item.
        </p>
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
                <TableHead className="font-semibold whitespace-nowrap">Kms Travelled</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <SortHead k="date" label="Date of Expense" />
                <SortHead k="amount" label="Amount" className="text-right" />
                <TableHead className="font-semibold">Emp.Remarks</TableHead>
                {hasFinanceItems && <TableHead className="font-semibold">First-level Approval</TableHead>}
                <TableHead className="font-semibold">Decision</TableHead>
                <TableHead className="font-semibold">Approval Amount</TableHead>
                <TableHead className="font-semibold">Mngr.Remarks</TableHead>
                <TableHead className="font-semibold">Bill Image</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-8 text-neutral-500">
                    No expenses awaiting your approval for this employee
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedExpenses.map((expense, index) => {
                    const form = forms[expense._id]
                    const stage = expenseStage(expense)
                    const rejecting = form?.decision === 'reject'
                    const amount = parsedAmount(expense)
                    const reference = stage === 'finance' ? firstLevelAmount(expense) ?? claimedAmount(expense) : claimedAmount(expense)
                    const edited = !rejecting && amount !== null && !Number.isNaN(amount) && amount !== reference
                    const firstBy = firstLevelApprovedBy(expense)
                    return (
                      <TableRow
                        key={expense._id}
                        className={`${rejecting ? 'bg-red-50/60' : index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{itemId(expense)}</TableCell>
                        <TableCell>
                          <div>{getExpenseType(expense.category)}</div>
                          <div className="text-[11px] text-neutral-500 max-w-[180px]">{expenseStatusText(expense)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-red-600">
                          {isTravel(expense) ? `${gpsKm(expense)} Kms` : <span className="text-neutral-400">-</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-medium">
                          {isTravel(expense) && expense.approxKms
                            ? `${expense.approxKms} Kms${expense.transportType ? ` · ${expense.transportType}` : ''}`
                            : <span className="text-neutral-400">-</span>}
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
                        {hasFinanceItems && (
                          <TableCell className="min-w-[180px] text-sm">
                            {stage === 'finance' ? (
                              <div className="space-y-0.5">
                                <div className="font-medium">{firstBy?.name || 'Unknown'}{firstBy?.role ? ` (${firstBy.role})` : ''}</div>
                                <div>Rs. {(firstLevelAmount(expense) ?? claimedAmount(expense)).toFixed(2)}</div>
                                {expense.managerRemarks && <div className="text-neutral-600">“{expense.managerRemarks}”</div>}
                              </div>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <select
                            value={form?.decision || 'approve'}
                            onChange={(e) => setForm(expense._id, { decision: e.target.value as Decision })}
                            className={`h-9 rounded-md border px-2 text-sm bg-white ${rejecting ? 'border-red-400 text-red-700' : 'border-neutral-300'}`}
                            aria-label={`Decision for item ${itemId(expense)}`}
                          >
                            <option value="approve">Approve</option>
                            <option value="reject">Reject</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form?.approvedAmount ?? ''}
                            onChange={(e) => setForm(expense._id, { approvedAmount: e.target.value })}
                            disabled={rejecting}
                            className={`w-32 bg-white text-sm font-medium ${edited ? 'border-orange-400 text-orange-700' : ''}`}
                            placeholder={stage === 'finance' ? 'Final Amount' : 'Approved Amount'}
                            aria-label={`Approval amount for item ${itemId(expense)}`}
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px] max-w-xs">
                          <Textarea
                            value={form?.remarks || ''}
                            onChange={(e) => setForm(expense._id, { remarks: e.target.value })}
                            placeholder={edited ? 'Remarks (required: amount changed)' : 'Remarks (optional)'}
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
                    <TableCell className="whitespace-nowrap">{totalClaimedKm.toFixed(2)} Kms</TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      Rs. {totalClaimed.toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={hasFinanceItems ? 3 : 2}></TableCell>
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

      {/* Submit */}
      {expenses.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-neutral-600">
            Approving {approving.length} item(s) for Rs. {totalApproved.toFixed(2)}
            {rejectingCount > 0 && `, rejecting ${rejectingCount}`}
            {totalApproved !== totalClaimed && rejectingCount === 0 && ` (claimed Rs. ${totalClaimed.toFixed(2)})`}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
          >
            {submitting ? 'Submitting...' : rejectingCount === expenses.length ? 'Reject' : 'Approve'}
          </Button>
        </div>
      )}
    </div>
  )
}
