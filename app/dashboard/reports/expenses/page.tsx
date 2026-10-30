'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { type ApprovalExpense, type ExpensePerson, expenseStatusColor, expenseStatusText, firstLevelApprovedBy } from '@/lib/expenseApproval'

type Expense = ApprovalExpense & {
  _id: string
  expItemId?: string
  amount: number
  category: string
  date: string
  createdAt: string
  employeeId?: (ExpensePerson & { zone?: string }) | null
  trainerId?: (ExpensePerson & { zone?: string }) | null
  /** Backend-resolved employee: employeeId, else trainerId, else submitter */
  employee?: (ExpensePerson & { zone?: string }) | null
  /** Server-computed status text (same wording as the export) */
  statusText?: string
  /** Travel kilometres claimed (server-computed) */
  kilometres?: number
  /** When the Finance Manager approved it (Approved expenses only) */
  financeApprovedAt?: string | null
}

type Employee = {
  _id: string
  name: string
  zone?: string
}

export default function ExpensesReportPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [filters, setFilters] = useState({
    zone: 'all',
    employeeId: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  })

  useEffect(() => {
    // Load employees and zones
    ;(async () => {
      try {
        const [empData, allExpenses] = await Promise.all([
          apiRequest<Employee[]>('/employees?isActive=true').catch(() => []),
          apiRequest<Expense[]>('/expenses').catch(() => []),
        ])
        
        setEmployees(empData || [])
        
        // Extract unique zones from employees and expenses
        const uniqueZones = new Set<string>()
        empData.forEach(emp => {
          if (emp.zone) uniqueZones.add(emp.zone)
        })
        allExpenses.forEach(exp => {
          const zone = exp.employee?.zone || exp.employeeId?.zone || exp.trainerId?.zone
          if (zone) uniqueZones.add(zone)
        })
        setZones(Array.from(uniqueZones).sort())
      } catch (error) {
        console.error('Failed to load employees/zones:', error)
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
      if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone)
      if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.fromDate) params.append('fromDate', filters.fromDate)
      if (filters.toDate) params.append('toDate', filters.toDate)

      const data = await apiRequest<Expense[]>(`/expenses/report${params.toString() ? `?${params.toString()}` : ''}`)
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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.zone && filters.zone !== 'all') params.append('zone', filters.zone)
      if (filters.employeeId && filters.employeeId !== 'all') params.append('employeeId', filters.employeeId)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.fromDate) params.append('fromDate', filters.fromDate)
      if (filters.toDate) params.append('toDate', filters.toDate)
      await downloadReportFile(`/expenses/export${params.toString() ? `?${params.toString()}` : ''}`, 'Expenses_Report.xlsx')
      toast.success('Export started')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export expenses')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0')
    
    return `${day}-${month}-${year} ${displayHours}:${minutes}:${seconds} ${ampm}`
  }

  const formatExpDate = (dateString: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const money = (v?: number) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Expenses</h1>
        <Button
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Filter Section */}
      <Card className="p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="zone" className="text-sm">Zone</Label>
            <Select
              value={filters.zone}
              onValueChange={(value) => setFilters({ ...filters, zone: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="employee" className="text-sm">Employee</Label>
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
          <div>
            <Label htmlFor="status" className="text-sm">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending at first level</SelectItem>
                <SelectItem value="finance">Pending at Finance</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Needs Correction">Sent back for correction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fromDate" className="text-sm">From Date</Label>
            <Input
              id="fromDate"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="bg-white"
            />
          </div>
          <div>
            <Label htmlFor="toDate" className="text-sm">To Date</Label>
            <Input
              id="toDate"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="bg-white"
            />
          </div>
        </div>
        <div className="mt-4">
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
                <TableHead className="font-semibold">Exp No</TableHead>
                <TableHead className="font-semibold">Created On</TableHead>
                <TableHead className="font-semibold">Exp Date</TableHead>
                <TableHead className="font-semibold">Employee Name</TableHead>
                <TableHead className="font-semibold text-right">Kilometer</TableHead>
                <TableHead className="font-semibold text-right">Expense Amount</TableHead>
                <TableHead className="font-semibold">First-level Approver</TableHead>
                <TableHead className="font-semibold text-right">First-level Amount</TableHead>
                <TableHead className="font-semibold">First-level Remarks</TableHead>
                <TableHead className="font-semibold">Finance Approver</TableHead>
                <TableHead className="font-semibold text-right">Final Amount</TableHead>
                <TableHead className="font-semibold">Finance Approved Date</TableHead>
                <TableHead className="font-semibold">Finance Remarks</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-neutral-500">
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-neutral-500">
                    No expenses found
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
                      {expense.expItemId || expense._id.toString().slice(-5)}
                    </TableCell>
                    <TableCell>{formatDate(expense.createdAt)}</TableCell>
                    <TableCell>{formatExpDate(expense.date)}</TableCell>
                    <TableCell className="font-medium">
                      {(expense.employee || expense.employeeId || expense.trainerId)?.name || '-'}
                    </TableCell>
                    <TableCell className="text-right">{expense.kilometres ? expense.kilometres : '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {money(expense.employeeAmount ?? expense.amount)}
                    </TableCell>
                    <TableCell>
                      {firstLevelApprovedBy(expense)?.name ||
                        (expense.rejectedStage === 'first' ? expense.rejectedBy?.name : '') ||
                        '-'}
                    </TableCell>
                    <TableCell className="text-right">{money(expense.firstLevelApprovedAmount)}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap">
                      {(firstLevelApprovedBy(expense) || expense.rejectedStage === 'first') && expense.managerRemarks
                        ? expense.managerRemarks
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {expense.status === 'Approved'
                        ? expense.approvedBy?.name || '-'
                        : expense.rejectedStage === 'finance'
                          ? expense.rejectedBy?.name || '-'
                          : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {expense.status === 'Approved' ? money(expense.approvedAmount) : '-'}
                    </TableCell>
                    <TableCell>{expense.financeApprovedAt ? formatExpDate(expense.financeApprovedAt) : '-'}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-pre-wrap">{expense.financeRemarks || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${expenseStatusColor(expense.status)}`}>
                        {expense.statusText || expenseStatusText(expense)}
                      </span>
                    </TableCell>
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

