'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle, Eye } from 'lucide-react'
import { ExpenseBillButton } from '@/components/expenses/ExpenseBillViewer'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  type ApprovalExpense,
  type ExpensePerson,
  approvalHistory,
  expenseStage,
  expenseStatusColor,
  expenseStatusText,
  firstLevelAmount,
  firstLevelApproverLabel,
  firstLevelApprovedBy,
} from '@/lib/expenseApproval'

type Expense = ApprovalExpense & {
  _id: string
  title: string
  description?: string
  amount: number
  category: string
  date?: string
  stayDateEnd?: string
  createdAt: string
  employeeId?: ExpensePerson | null
  trainerId?: ExpensePerson | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: ExpensePerson | null
  department?: string
  paymentMethod?: string
  receipt?: string
  ticketReceipt?: string
  receiptNumber?: string
  expItemId?: string
  transportType?: string
  travelFrom?: string
  travelTo?: string
  approxKms?: number
  gpsDistance?: number
  pendingMonth?: string
}

const getEmployee = (expense: Expense) =>
  expense.employee || expense.employeeId || expense.trainerId || expense.createdBy || null

type Employee = {
  _id: string
  name: string
}

type Trainer = {
  _id: string
  name: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1').replace(', ', ' ')
}

const formatDay = (dateString?: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
}

const formatAmount = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'

const getExpenseType = (category: string) => {
  if (!category) return '-'
  if (category === 'Other') return 'Others'
  return category.charAt(0).toUpperCase() + category.slice(1)
}

const getPendingMonth = (expense: Expense) => {
  if (expense.pendingMonth) return expense.pendingMonth
  const date = new Date(expense.createdAt)
  return date.toLocaleString('en-US', { month: 'long' })
}

export default function ManagerPendingExpensesPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [filters, setFilters] = useState({
    employeeId: 'all',
    trainerId: 'all',
  })
  const [viewing, setViewing] = useState<Expense | null>(null)
  const [role, setRole] = useState('')

  useEffect(() => {
    setRole(getCurrentUser()?.role || '')
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [empData, trainerData] = await Promise.all([
          apiRequest<Employee[]>('/employees?isActive=true').catch(() => []),
          apiRequest<Trainer[]>('/trainers?status=active').catch(() => []),
        ])
        setEmployees(empData || [])
        setTrainers(trainerData || [])
      } catch (error) {
        console.error('Failed to load employees/trainers:', error)
      }
    })()
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId)
      if (filters.trainerId && filters.trainerId !== 'all') params.append('trainerId', filters.trainerId)

      const data = await apiRequest<Expense[]>(`/expenses/manager-pending${params.toString() ? `?${params.toString()}` : ''}`)
      setExpenses(data || [])
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // Approving needs an amount and (at first level) a remark per item, so it happens on
  // the per-item review page for the employee.
  const openReview = (expense: Expense) => {
    const employeeId = getEmployee(expense)?._id
    if (!employeeId) {
      toast.error('This expense has no employee to review')
      return
    }
    router.push(`/dashboard/expenses/manager-update/${employeeId}`)
  }

  const isFinance = role === 'Finance Manager'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Expenses List</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {isFinance
            ? 'Expenses approved at first level and awaiting your final approval.'
            : 'Expenses awaiting your approval. Open one to review its full details, then approve or reject it on the review page.'}
        </p>
      </div>

      {/* Filter Section */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Select
              value={filters.employeeId}
              onValueChange={(value) => setFilters({ ...filters, employeeId: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={filters.trainerId}
              onValueChange={(value) => setFilters({ ...filters, trainerId: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Trainer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trainers</SelectItem>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer._id} value={trainer._id}>
                    {trainer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={loadExpenses} className="bg-blue-600 hover:bg-blue-700 text-white">
            Search
          </Button>
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Employee Name</TableHead>
                <TableHead className="font-semibold">Raised Date</TableHead>
                <TableHead className="font-semibold">Exp Type</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold text-right">1st Level Amount</TableHead>
                <TableHead className="font-semibold">Approval Status</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Pending Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-neutral-500">
                    No expenses are awaiting your approval.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense, index) => (
                  <TableRow
                    key={expense._id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{getEmployee(expense)?.name || '-'}</TableCell>
                    <TableCell>{formatDate(expense.createdAt)}</TableCell>
                    <TableCell>{getExpenseType(expense.category)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(expense.employeeAmount ?? expense.amount)}
                    </TableCell>
                    <TableCell className="text-right">{formatAmount(firstLevelAmount(expense))}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${expenseStatusColor(expense.status)}`}>
                        {expenseStatusText(expense)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewing(expense)}
                          className="text-blue-600 hover:text-blue-700 transition-colors"
                          aria-label="View expense details"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <Button
                          onClick={() => openReview(expense)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{getPendingMonth(expense)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ExpenseDetailsDialog
        expense={viewing}
        onClose={() => setViewing(null)}
        onReview={(exp) => openReview(exp)}
      />
    </div>
  )
}


function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '-') return null
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 break-words whitespace-pre-wrap">{value}</span>
    </div>
  )
}

/** Bill / ticket, opened in the in-app viewer. */
function Attachment({ label, url }: { label: string; url?: string }) {
  return <ExpenseBillButton label={label} url={url} />
}

function ExpenseDetailsDialog({
  expense,
  onClose,
  onReview,
}: {
  expense: Expense | null
  onClose: () => void
  onReview: (expense: Expense) => void
}) {
  const employee = expense ? getEmployee(expense) : null
  const submitter = expense?.createdBy
  const isTravel = expense?.category?.toLowerCase() === 'travel'
  const isStay = /^accom/i.test(expense?.category || '')
  const stage = expense ? expenseStage(expense) : null
  const firstBy = expense ? firstLevelApprovedBy(expense) : null

  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {expense && (
          <>
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
              <DialogDescription>
                {expense.title || `${getExpenseType(expense.category)} expense`} · raised {formatDate(expense.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="space-y-1">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${expenseStatusColor(expense.status)}`}>
                  {expenseStatusText(expense)}
                </span>
                {stage === 'first' && (
                  <p className="text-xs text-neutral-500">
                    First-level approver: {firstLevelApproverLabel(expense.firstLevelApprover)}
                    {expense.firstLevelApprover?.kind === 'tag' && expense.firstLevelApprover.scope
                      ? ` (tagged by Admin for ${expense.firstLevelApprover.scope === 'all' ? 'all employees' : `this ${expense.firstLevelApprover.scope}`})`
                      : ''}
                  </p>
                )}
              </div>

              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-1">Employee</h3>
                <div className="divide-y divide-neutral-100">
                  <DetailRow label="Name" value={employee?.name || '-'} />
                  <DetailRow label="Employee Code" value={employee?.empCode} />
                  <DetailRow label="Role" value={employee?.role} />
                  <DetailRow label="Email" value={employee?.email} />
                  <DetailRow label="Department" value={expense.department} />
                  {submitter && employee && submitter._id !== employee._id && (
                    <DetailRow label="Raised By" value={`${submitter.name}${submitter.role ? ` (${submitter.role})` : ''}`} />
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-1">Expense</h3>
                <div className="divide-y divide-neutral-100">
                  <DetailRow label="Type" value={getExpenseType(expense.category)} />
                  <DetailRow
                    label={isStay && expense.stayDateEnd ? 'Stay Dates' : 'Expense Date'}
                    value={
                      isStay && expense.stayDateEnd
                        ? `${formatDay(expense.date)} – ${formatDay(expense.stayDateEnd)}`
                        : formatDay(expense.date)
                    }
                  />
                  <DetailRow label="Hotel Name" value={(expense as any).hotelName} />
                  <DetailRow label="Hotel Address" value={(expense as any).hotelAddress} />
                  <DetailRow label="Check-in" value={(expense as any).checkInDate ? formatDay((expense as any).checkInDate) : undefined} />
                  <DetailRow label="Check-out" value={(expense as any).checkOutDate ? formatDay((expense as any).checkOutDate) : undefined} />
                  <DetailRow label="Description" value={expense.description} />
                  <DetailRow label="Employee Remarks" value={expense.employeeRemarks} />
                  <DetailRow label="Receipt No." value={expense.receiptNumber} />
                  <DetailRow label="Item ID" value={expense.expItemId} />
                  <DetailRow label="Payment Method" value={expense.paymentMethod} />
                </div>
              </section>

              {isTravel && (
                <section>
                  <h3 className="text-sm font-semibold text-neutral-900 mb-1">Travel</h3>
                  <div className="divide-y divide-neutral-100">
                    <DetailRow label="Mode" value={expense.transportType} />
                    <DetailRow label="From" value={expense.travelFrom} />
                    <DetailRow label="To" value={expense.travelTo} />
                    <DetailRow label="Claimed Distance" value={expense.approxKms ? `${expense.approxKms} km` : undefined} />
                    <DetailRow label="GPS Distance" value={expense.gpsDistance ? `${expense.gpsDistance} km` : undefined} />
                  </div>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-1">Amounts</h3>
                <div className="divide-y divide-neutral-100">
                  <DetailRow label="Claimed" value={formatAmount(expense.employeeAmount ?? expense.amount)} />
                  <DetailRow
                    label="First-level Approved"
                    value={
                      firstLevelAmount(expense) !== undefined
                        ? `${formatAmount(firstLevelAmount(expense))}${firstBy?.name ? ` by ${firstBy.name}` : ''}`
                        : undefined
                    }
                  />
                  <DetailRow label="First-level Remarks" value={stage !== 'first' ? expense.managerRemarks : undefined} />
                  {expense.status === 'Approved' && (
                    <DetailRow label="Final Approved" value={formatAmount(expense.approvedAmount)} />
                  )}
                  <DetailRow label="Finance Remarks" value={expense.financeRemarks} />
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Attachments</h3>
                {expense.receipt || expense.ticketReceipt ? (
                  <div className="space-y-3">
                    <Attachment label="Bill / Receipt" url={expense.receipt} />
                    <Attachment label="Ticket / Proof" url={expense.ticketReceipt} />
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No bills attached.</p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-neutral-900 mb-2">Approval History</h3>
                <ol className="space-y-2">
                  {approvalHistory(expense).map((h, i) => (
                    <li key={i} className="text-sm border-l-2 border-neutral-200 pl-3">
                      <div className="font-medium text-neutral-900">{h.step}</div>
                      <div className="text-neutral-500">
                        {h.by?.name || 'Unknown'}
                        {h.by?.role ? ` (${h.by.role})` : ''}
                        {h.at ? ` · ${formatDate(h.at)}` : ''}
                        {typeof h.amount === 'number' ? ` · Rs. ${formatAmount(h.amount)}` : ''}
                      </div>
                      {h.remarks && <div className="text-neutral-700 mt-0.5">“{h.remarks}”</div>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => onReview(expense)} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-1" />
                Review &amp; Decide
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
