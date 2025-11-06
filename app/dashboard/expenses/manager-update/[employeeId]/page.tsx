'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { ExternalLink } from 'lucide-react'

type Expense = {
  _id: string
  title: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  category: string
  description?: string
  employeeRemarks?: string
  managerRemarks?: string
  date: string
  gpsDistance?: number
  expItemId?: string
  receipt?: string
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
  const [employeeName, setEmployeeName] = useState('')

  // Form state for each expense
  const [expenseForms, setExpenseForms] = useState<Record<string, {
    approvedAmount: string
    managerRemarks: string
  }>>({})

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

      const data = await apiRequest<Expense[]>(`/expenses/employee/${employeeId}${params.toString() ? `?${params.toString()}` : ''}`)
      
      setExpenses(data || [])
      
      // Initialize form state
      const initialForms: Record<string, { approvedAmount: string; managerRemarks: string }> = {}
      data.forEach(exp => {
        initialForms[exp._id] = {
          approvedAmount: exp.approvedAmount?.toString() || exp.amount.toString(),
          managerRemarks: exp.managerRemarks || '',
        }
      })
      setExpenseForms(initialForms)

      // Set employee name from first expense
      if (data.length > 0) {
        setEmployeeName(data[0].employeeId?.name || data[0].trainerId?.name || '')
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

  const handleApprove = async () => {
    if (expenses.length === 0) {
      toast.error('No expenses to approve')
      return
    }

    setSubmitting(true)
    try {
      const expensesToApprove = expenses.map(exp => ({
        id: exp._id,
        approvedAmount: expenseForms[exp._id]?.approvedAmount 
          ? parseFloat(expenseForms[exp._id].approvedAmount) 
          : exp.amount,
        managerRemarks: expenseForms[exp._id]?.managerRemarks || '',
      }))

      await apiRequest('/expenses/approve-multiple', {
        method: 'POST',
        body: JSON.stringify({ expenses: expensesToApprove }),
      })

      toast.success(`${expenses.length} expense(s) approved successfully`)
      router.push('/dashboard/expenses/pending')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to approve expenses')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getExpenseType = (category: string) => {
    // Map to match expected values
    if (category === 'Travel') return 'Travel'
    if (category === 'Food') return 'Food'
    return category
  }

  const totalAmount = expenses.reduce((sum, exp) => {
    const approvedAmount = expenseForms[exp._id]?.approvedAmount 
      ? parseFloat(expenseForms[exp._id].approvedAmount) 
      : exp.amount
    return sum + approvedAmount
  }, 0)

  const totalGpsDistance = expenses.reduce((sum, exp) => sum + (exp.gpsDistance || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Manager Expense Update</h1>
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
            <Button variant="outline" className="bg-white">
              View Employee Track
            </Button>
          </div>
          <div className="text-lg font-semibold text-neutral-900">
            Employee: <span className="text-blue-600">{employeeName || 'Loading...'}</span>
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
                <TableHead className="font-semibold">Exp Item ID</TableHead>
                <TableHead className="font-semibold">Expense Type</TableHead>
                <TableHead className="font-semibold">GPS Dist</TableHead>
                <TableHead className="font-semibold">Description</TableHead>
                <TableHead className="font-semibold">Date of Expense</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
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
                    No pending expenses found for this employee
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {expenses.map((expense, index) => (
                    <TableRow
                      key={expense._id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}`}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {expense.expItemId || expense._id.slice(-5)}
                      </TableCell>
                      <TableCell>{getExpenseType(expense.category)}</TableCell>
                      <TableCell className="text-right">
                        {expense.gpsDistance ? `${expense.gpsDistance.toFixed(1)} Kms` : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Textarea
                          value={expense.description || expense.title || ''}
                          readOnly
                          className="min-h-[60px] resize-none bg-neutral-50 text-sm border-0"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>{formatDate(expense.date)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {expense.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="max-w-xs">
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
                          value={expenseForms[expense._id]?.approvedAmount || expense.amount.toString()}
                          onChange={(e) => handleFormChange(expense._id, 'approvedAmount', e.target.value)}
                          className="w-32 bg-white text-sm font-medium"
                          placeholder="Approved P"
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Textarea
                          value={expenseForms[expense._id]?.managerRemarks || ''}
                          onChange={(e) => handleFormChange(expense._id, 'managerRemarks', e.target.value)}
                          placeholder="Manager Remarks"
                          className="min-h-[60px] resize-none bg-white text-sm"
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        {expense.receipt ? (
                          <a
                            href={expense.receipt}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                          >
                            Image 1
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-neutral-400 text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-neutral-100 font-semibold">
                    <TableCell colSpan={3} className="text-right">
                      Total:
                    </TableCell>
                    <TableCell className="text-right">
                      {totalGpsDistance > 0 ? `${totalGpsDistance.toFixed(1)} Kms` : '0 Kms'}
                    </TableCell>
                    <TableCell colSpan={4}></TableCell>
                    <TableCell className="text-right">
                      Rs. {totalAmount.toFixed(2)}
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
        <div className="flex justify-center">
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

