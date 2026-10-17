'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
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
import { Pencil, CheckCircle, Eye, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

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
  description?: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  category: string
  status: 'Pending' | 'Executive Manager Approved' | 'Manager Approved' | 'Approved' | 'Rejected'
  date?: string
  stayDateEnd?: string
  createdAt: string
  employeeId?: Person | null
  trainerId?: Person | null
  createdBy?: Person | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: Person | null
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
  employeeRemarks?: string
  managerRemarks?: string
  rejectionReason?: string
  executiveManagerApprovedBy?: Person | null
  executiveManagerApprovedAt?: string
  managerApprovedBy?: Person | null
  managerApprovedAt?: string
  approvedBy?: Person | null
  approvedAt?: string
  returnedBy?: Person | null
  returnedAt?: string
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
  const [approving, setApproving] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Expense | null>(null)
  const [role, setRole] = useState('')

  useEffect(() => {
    setRole(getCurrentUser()?.role || '')
  }, [])

  useEffect(() => {
    // Load employees and trainers
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

  const handleSearch = () => {
    loadExpenses()
  }

  const handleEdit = (expenseId: string, employeeId?: string) => {
    // Navigate to manager expense update page for the employee
    if (employeeId) {
      router.push(`/dashboard/expenses/manager-update/${employeeId}`)
    } else {
      router.push(`/dashboard/expenses/edit/${expenseId}`)
    }
  }

  const handleApprove = async (expenseId: string, currentStatus: string) => {
    setApproving(expenseId)
    try {
      const user = getCurrentUser()
      const oversightRoles = new Set(['Admin', 'Super Admin', 'Coordinator', 'Finance Manager'])
      const nextStatus =
        currentStatus === 'Pending' && oversightRoles.has(user?.role || '')
          ? 'Executive Manager Approved'
          : 'Approved'

      await apiRequest(`/expenses/${expenseId}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      })
      toast.success(
        nextStatus === 'Executive Manager Approved'
          ? 'Expense forwarded for manager approval'
          : 'Expense approved successfully'
      )
      setViewing(null)
      loadExpenses()
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve expense')
    } finally {
      setApproving(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
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
    // Map categories to display format
    if (category === 'Other') return 'Others'
    return category
  }

  const getPendingMonth = (expense: Expense) => {
    if (expense.pendingMonth) return expense.pendingMonth
    // Fallback: calculate from createdAt date
    const date = new Date(expense.createdAt)
    return date.toLocaleString('en-US', { month: 'long' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700'
      case 'Manager Approved':
        return 'bg-blue-100 text-blue-700'
      case 'Executive Manager Approved':
        return 'bg-purple-100 text-purple-700'
      case 'Pending':
        return 'bg-amber-100 text-amber-700'
      case 'Rejected':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusDisplay = (status: string) => {
    if (status === 'Pending') return 'Pending at Zonal Manager'
    if (status === 'Manager Approved') return 'Product Manager Approved'
    if (status === 'Executive Manager Approved') return 'Approved by Zonal Manager, Pending at Product Manager'
    if (status === 'Approved') return 'Approved'
    return status
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          {role === 'Manager' ? 'Product Manager Pending Expenses List' : 'Pending Expenses List'}
        </h1>
        {role && role !== 'Manager' && (
          <p className="text-sm text-neutral-500 mt-1">
            Expenses awaiting Zonal Manager or Product Manager approval. Open a row to review its full details before approving.
          </p>
        )}
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
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
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
                <TableHead className="font-semibold">Approval Status</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Pending Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-neutral-500">
                    No pending expenses found.
                    <span className="block text-sm text-neutral-400 mt-1">
                      New submissions appear here while awaiting Zonal Manager or Product Manager approval.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((expense, index) => (
                  <TableRow
                    key={expense._id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {getEmployee(expense)?.name || '-'}
                    </TableCell>
                    <TableCell>{formatDate(expense.createdAt)}</TableCell>
                    <TableCell>{getExpenseType(expense.category)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {expense.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                        {getStatusDisplay(expense.status)}
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
                        <button
                          onClick={() => handleEdit(expense._id, getEmployee(expense)?._id)}
                          className="text-orange-600 hover:text-orange-700 transition-colors"
                          aria-label="Update expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <Button
                          onClick={() => handleApprove(expense._id, expense.status)}
                          disabled={approving === expense._id}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white h-7 px-2 text-xs"
                        >
                          {approving === expense._id ? (
                            'Approving...'
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </>
                          )}
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
        onApprove={(exp) => handleApprove(exp._id, exp.status)}
        approving={!!viewing && approving === viewing._id}
        formatDate={formatDate}
        formatDay={formatDay}
        formatAmount={formatAmount}
        getExpenseType={getExpenseType}
        getStatusColor={getStatusColor}
        getStatusDisplay={getStatusDisplay}
      />
    </div>
  )
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '-') return null
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 break-words whitespace-pre-wrap">{value}</span>
    </div>
  )
}

function Attachment({ label, url }: { label: string; url?: string }) {
  const href = resolveUploadUrl(url)
  if (!href) return null
  return (
    <div className="space-y-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 text-sm font-medium"
      >
        {label}
        <ExternalLink className="h-3 w-3" />
      </a>
      {IMAGE_EXT.test(href) && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={label} className="max-h-64 rounded-md border border-neutral-200 object-contain" />
        </a>
      )}
    </div>
  )
}

function ExpenseDetailsDialog({
  expense,
  onClose,
  onApprove,
  approving,
  formatDate,
  formatDay,
  formatAmount,
  getExpenseType,
  getStatusColor,
  getStatusDisplay,
}: {
  expense: Expense | null
  onClose: () => void
  onApprove: (expense: Expense) => void
  approving: boolean
  formatDate: (d: string) => string
  formatDay: (d?: string) => string
  formatAmount: (v?: number) => string
  getExpenseType: (c: string) => string
  getStatusColor: (s: string) => string
  getStatusDisplay: (s: string) => string
}) {
  const employee = expense ? getEmployee(expense) : null
  const submitter = expense?.createdBy
  const isTravel = expense?.category?.toLowerCase() === 'travel'
  const isStay = /^accom/i.test(expense?.category || '')
  const amountEdited =
    !!expense &&
    typeof expense.approvedAmount === 'number' &&
    expense.approvedAmount !== (expense.employeeAmount ?? expense.amount)

  const history = expense
    ? [
        { step: 'Submitted', by: submitter, at: expense.createdAt, remarks: expense.employeeRemarks },
        expense.executiveManagerApprovedAt || expense.executiveManagerApprovedBy
          ? { step: 'Approved by Zonal Manager', by: expense.executiveManagerApprovedBy, at: expense.executiveManagerApprovedAt }
          : null,
        expense.managerApprovedAt || expense.managerApprovedBy
          ? { step: 'Approved by Product Manager', by: expense.managerApprovedBy, at: expense.managerApprovedAt }
          : null,
        expense.approvedAt || expense.approvedBy
          ? { step: 'Approved by Finance', by: expense.approvedBy, at: expense.approvedAt }
          : null,
        expense.returnedAt || expense.returnedBy
          ? { step: 'Sent back for correction', by: expense.returnedBy, at: expense.returnedAt, remarks: expense.rejectionReason }
          : null,
      ].filter((h): h is NonNullable<typeof h> => !!h)
    : []

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
              <div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                  {getStatusDisplay(expense.status)}
                </span>
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
                  <DetailRow label="Description" value={expense.description} />
                  <DetailRow label="Employee Remarks" value={expense.employeeRemarks} />
                  <DetailRow label="Manager Remarks" value={expense.managerRemarks} />
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
                <h3 className="text-sm font-semibold text-neutral-900 mb-1">Amount</h3>
                <div className="divide-y divide-neutral-100">
                  <DetailRow label="Claimed" value={formatAmount(expense.employeeAmount ?? expense.amount)} />
                  {typeof expense.approvedAmount === 'number' && (
                    <DetailRow
                      label="Approved"
                      value={
                        <span className={amountEdited ? 'text-orange-700 font-medium' : undefined}>
                          {formatAmount(expense.approvedAmount)}
                          {amountEdited ? ' (edited by approver)' : ''}
                        </span>
                      }
                    />
                  )}
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
                  {history.map((h, i) => (
                    <li key={i} className="text-sm border-l-2 border-neutral-200 pl-3">
                      <div className="font-medium text-neutral-900">{h.step}</div>
                      <div className="text-neutral-500">
                        {h.by?.name || 'Unknown'}
                        {h.by?.role ? ` (${h.by.role})` : ''}
                        {h.at ? ` · ${formatDate(h.at)}` : ''}
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
              <Button
                onClick={() => onApprove(expense)}
                disabled={approving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {approving ? 'Approving...' : 'Approve'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

