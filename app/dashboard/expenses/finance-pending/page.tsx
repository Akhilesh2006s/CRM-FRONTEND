'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Expense = {
  _id: string
  title: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  category: string
  status: 'Pending' | 'Manager Approved' | 'Approved' | 'Rejected'
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
  managerApprovedBy?: {
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

export default function FinancePendingExpensesPage() {
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [filters, setFilters] = useState({
    employeeId: 'all',
    trainerId: 'all',
  })

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

      const data = await apiRequest<Expense[]>(`/expenses/finance-pending${params.toString() ? `?${params.toString()}` : ''}`)
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

  const handleEdit = (expenseId: string) => {
    router.push(`/dashboard/expenses/edit/${expenseId}`)
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
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Finance Pending Expenses List</h1>
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
                <TableHead className="font-semibold text-right">Emp.Amount</TableHead>
                <TableHead className="font-semibold">Approved Manager</TableHead>
                <TableHead className="font-semibold text-right">Approved Amount</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Pending Months</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-neutral-500 font-medium">No finance pending expenses found</p>
                      <p className="text-sm text-neutral-400">
                        Expenses need to be approved by managers first before they appear here.
                      </p>
                    </div>
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
                    <TableCell className="text-right font-medium">
                      {(expense.employeeAmount || expense.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {expense.managerApprovedBy?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(expense.approvedAmount || expense.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleEdit(expense._id)}
                        className="text-orange-600 hover:text-orange-700 transition-colors"
                        aria-label="Edit expense"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
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

