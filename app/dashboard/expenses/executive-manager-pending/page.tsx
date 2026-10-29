'use client'

import { Suspense, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, CheckCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { type ApprovalExpense, expenseStatusColor, expenseStatusText } from '@/lib/expenseApproval'
import { toast } from 'sonner'

type Expense = ApprovalExpense & {
  _id: string
  title: string
  amount: number
  category: string
  status: 'Pending' | 'Executive Manager Approved' | 'Manager Approved' | 'Approved' | 'Rejected'
  createdAt: string
  employeeId?: {
    _id: string
    name: string
    email: string
  }
  trainerId?: {
    _id: string
    name: string
    email: string
  }
  createdBy?: { _id: string; name: string } | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: { _id: string; name: string } | null
  pendingMonth?: string
  date?: string
  approvedAmount?: number
}

const getEmployee = (expense: Expense) =>
  expense.employee || expense.employeeId || expense.trainerId || expense.createdBy || null

type Employee = {
  _id: string
  name: string
}

export default function ExecutiveManagerPendingExpensesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading...</div>}>
      <ExecutiveManagerExpenses />
    </Suspense>
  )
}

/** Team expenses: awaiting this Zonal Manager, or already approved / rejected by them (with status now). */
function ExecutiveManagerExpenses() {
  const router = useRouter()
  const tab: 'pending' | 'decided' = useSearchParams()?.get('tab') === 'decided' ? 'decided' : 'pending'
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filters, setFilters] = useState({
    employeeId: 'all',
  })

  useEffect(() => {
    ;(async () => {
      try {
        const currentUser = getCurrentUser()
        if (currentUser?.role !== 'Executive Manager') return

        const empData = await apiRequest<Employee[]>('/executive-managers/my/executives').catch(() => [])
        setEmployees(empData || [])
      } catch (error) {
        console.error('Failed to load employees:', error)
      }
    })()
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [filters, tab])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.employeeId && filters.employeeId !== 'all') {
        params.append('employeeId', filters.employeeId)
      }

      const base = tab === 'decided' ? '/expenses/my-decisions' : '/expenses/executive-manager-pending'
      const data = await apiRequest<Expense[]>(`${base}${params.toString() ? `?${params.toString()}` : ''}`)
      console.log('Loaded expenses:', data)
      setExpenses(data || [])
      
      // Show info if no expenses found
      if (!data || data.length === 0) {
        console.log('No expenses found. Employees assigned:', employees.length)
      }
    } catch (error: any) {
      console.error('Error loading expenses:', error)
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1').replace(', ', ' ')
  }

  const getExpenseType = (category: string) => {
    // Map categories to display format
    if (category === 'Other') return 'Others'
    if (category === 'travel') return 'Travel'
    if (category === 'food') return 'Food'
    if (category === 'accommodation') return 'Accommodation'
    if (category === 'others') return 'Others'
    return category
  }

  const getPendingMonth = (expense: Expense) => {
    if (expense.pendingMonth) return expense.pendingMonth
    // Fallback: calculate from createdAt date
    const date = new Date(expense.createdAt)
    return date.toLocaleString('en-US', { month: 'long' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          {tab === 'decided' ? 'Team Expenses: Approved / Rejected' : 'Team Expenses to Approve'}
        </h1>
        <div className="flex gap-2 mt-3">
          <Link href="/dashboard/expenses/executive-manager-pending">
            <Button size="sm" variant={tab === 'pending' ? 'default' : 'outline'}>To Approve</Button>
          </Link>
          <Link href="/dashboard/expenses/executive-manager-pending?tab=decided">
            <Button size="sm" variant={tab === 'decided' ? 'default' : 'outline'}>Approved / Rejected</Button>
          </Link>
        </div>
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
          <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 text-white">
            Search
          </Button>
        </div>
        {employees.length === 0 && (
          <p className="text-sm text-amber-600 mt-2">
            No employees assigned to you. Please contact an administrator to assign employees.
          </p>
        )}
        {employees.length > 0 && (
          <p className="text-sm text-neutral-500 mt-2">
            Showing expenses for {employees.length} assigned employee{employees.length !== 1 ? 's' : ''}
          </p>
        )}
      </Card>

      {tab === 'decided' && (
        <Card className="shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-neutral-50">
                  <TableHead className="font-semibold">S.No</TableHead>
                  <TableHead className="font-semibold">Employee Name</TableHead>
                  <TableHead className="font-semibold">Expense Date</TableHead>
                  <TableHead className="font-semibold">Exp Type</TableHead>
                  <TableHead className="font-semibold text-right">Claimed</TableHead>
                  <TableHead className="font-semibold text-right">Approved</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Your Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-neutral-500">Loading expenses...</TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-neutral-500">You have not approved or rejected any expenses yet.</TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense, index) => (
                    <TableRow key={expense._id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{getEmployee(expense)?.name || '-'}</TableCell>
                      <TableCell>{expense.date ? new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</TableCell>
                      <TableCell>{getExpenseType(expense.category)}</TableCell>
                      <TableCell className="text-right">{Number(expense.employeeAmount ?? expense.amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {expense.status === 'Rejected' ? '-' : Number(expense.firstLevelApprovedAmount ?? expense.approvedAmount ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${expenseStatusColor(expense.status)}`}>
                          {expenseStatusText(expense)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600 max-w-xs">{expense.managerRemarks || expense.rejectionReason || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Expenses Table */}
      {tab === 'pending' && <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Employee Name</TableHead>
                <TableHead className="font-semibold">Raised Date</TableHead>
                <TableHead className="font-semibold">Exp Type</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Approve</TableHead>
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
                    {employees.length === 0 
                      ? 'No employees assigned to you. Please contact an administrator.' 
                      : 'No expenses are awaiting your approval'}
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
                      <button
                        onClick={() => handleEdit(expense._id, getEmployee(expense)?._id)}
                        className="text-orange-600 hover:text-orange-700 transition-colors"
                        aria-label="Update expense"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TableCell>
                    <TableCell>
                      {/* Approval needs an amount per item (remarks optional), entered on the review page. */}
                      <Button
                        onClick={() => handleEdit(expense._id, getEmployee(expense)?._id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Review &amp; Approve
                      </Button>
                    </TableCell>
                    <TableCell>{getPendingMonth(expense)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>}
    </div>
  )
}

