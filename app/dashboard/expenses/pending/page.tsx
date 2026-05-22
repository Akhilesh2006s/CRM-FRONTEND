'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
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
  pendingMonth?: string
}

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

  const handleApprove = async (expenseId: string) => {
    setApproving(expenseId)
    try {
      await apiRequest(`/expenses/${expenseId}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Approved',
        }),
      })
      toast.success('Expense approved successfully')
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
    if (status === 'Pending') return 'Pending at Executive Manager'
    if (status === 'Executive Manager Approved') return 'Approved by Executive Manager, Pending at Manager'
    if (status === 'Approved') return 'Approved'
    return status
  }

  return (
    <div className="space-y-6">
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
                    No pending expenses found
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
                      {expense.employeeId?.name || expense.trainerId?.name || '-'}
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
                          onClick={() => handleEdit(expense._id, expense.employeeId?._id || expense.trainerId?._id)}
                          className="text-orange-600 hover:text-orange-700 transition-colors"
                          aria-label="Update expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <Button
                          onClick={() => handleApprove(expense._id)}
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
    </div>
  )
}

