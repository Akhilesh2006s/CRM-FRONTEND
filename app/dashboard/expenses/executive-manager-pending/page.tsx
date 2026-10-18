'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Expense = {
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
}

const getEmployee = (expense: Expense) =>
  expense.employee || expense.employeeId || expense.trainerId || expense.createdBy || null

type Employee = {
  _id: string
  name: string
}

export default function ExecutiveManagerPendingExpensesPage() {
  const router = useRouter()
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
  }, [filters])

  const loadExpenses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.employeeId && filters.employeeId !== 'all') {
        params.append('employeeId', filters.employeeId)
      }

      const data = await apiRequest<Expense[]>(
        `/expenses/executive-manager-pending${params.toString() ? `?${params.toString()}` : ''}`
      )
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
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Expenses List</h1>
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
                      {/* Approval needs an amount and remarks per item, entered on the review page. */}
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
      </Card>
    </div>
  )
}

