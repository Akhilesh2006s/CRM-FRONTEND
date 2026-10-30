'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Eye } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { type ApprovalExpense, approvalHistory, expenseStatusColor, expenseStatusText, isExpenseCompleted } from '@/lib/expenseApproval'
import { ExpenseBillButton } from '@/components/expenses/ExpenseBillViewer'

type Expense = ApprovalExpense & {
  _id: string
  title: string
  amount: number
  category: string
  date: string
  createdAt: string
  employeeRemarks?: string
  managerRemarks?: string
  approvedAmount?: number
  receipt?: string
  ticketReceipt?: string
  receiptNumber?: string
  transportType?: string
  travelFrom?: string
  travelTo?: string
  approxKms?: number
  hotelName?: string
  hotelAddress?: string
  checkInDate?: string
  checkOutDate?: string
}

/** Completed = rejected, or approved by Finance and credited to the bank; everything else is still moving. */
type View = 'pending' | 'completed'

const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const getExpenseType = (category: string) => {
  if (!category) return '-'
  if (category === 'Other' || category === 'others') return 'Others'
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '' || value === '-') return null
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-1.5 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-900 break-words whitespace-pre-wrap">{value}</span>
    </div>
  )
}

function ExpenseView({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  return (
    <Dialog open={!!expense} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        {expense && (
          <>
            <DialogHeader>
              <DialogTitle>{getExpenseType(expense.category)} Expense</DialogTitle>
              <DialogDescription>Raised {formatDate(expense.createdAt)}</DialogDescription>
            </DialogHeader>
            <span className={`w-fit px-2 py-1 rounded text-xs font-medium ${expenseStatusColor(expense.status)}`}>
              {expenseStatusText(expense)}
            </span>
            <div className="divide-y divide-neutral-100">
              <DetailRow label="Date" value={formatDate(expense.date)} />
              <DetailRow label="Amount" value={`Rs. ${Number(expense.employeeAmount ?? expense.amount).toFixed(2)}`} />
              <DetailRow label="Approved Amount" value={expense.approvedAmount != null ? `Rs. ${expense.approvedAmount.toFixed(2)}` : undefined} />
              <DetailRow label="Travel" value={expense.transportType ? `${expense.travelFrom || '?'} → ${expense.travelTo || '?'} by ${expense.transportType}` : undefined} />
              <DetailRow label="Kilometres" value={expense.approxKms ? `${expense.approxKms} km` : undefined} />
              <DetailRow label="Hotel Name" value={expense.hotelName} />
              <DetailRow label="Hotel Address" value={expense.hotelAddress} />
              <DetailRow label="Check-in" value={expense.checkInDate ? formatDate(expense.checkInDate) : undefined} />
              <DetailRow label="Check-out" value={expense.checkOutDate ? formatDate(expense.checkOutDate) : undefined} />
              <DetailRow label="Bill Number" value={expense.receiptNumber} />
              <DetailRow label="Remarks" value={expense.employeeRemarks} />
            </div>
            <section>
              <h3 className="text-sm font-semibold text-neutral-900 mb-1">Approval history</h3>
              <ul className="space-y-1 text-sm">
                {approvalHistory(expense).map((entry, i) => (
                  <li key={i} className="text-neutral-700">
                    <span className="font-medium">{entry.step}</span>
                    {entry.by?.name ? ` · ${entry.by.name}` : ''}
                    {entry.at ? ` · ${formatDate(entry.at)}` : ''}
                    {entry.amount != null ? ` · Rs. ${Number(entry.amount).toFixed(2)}` : ''}
                    {entry.remarks ? ` · “${entry.remarks}”` : ''}
                  </li>
                ))}
              </ul>
            </section>
            {(expense.receipt || expense.ticketReceipt) && (
              <div className="flex gap-4">
                <ExpenseBillButton label="Bill" url={expense.receipt} />
                <ExpenseBillButton label="Ticket" url={expense.ticketReceipt} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MyExpensesList() {
  const searchParams = useSearchParams()
  const view: View = searchParams?.get('view') === 'completed' ? 'completed' : 'pending'
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<Expense | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const data = await apiRequest<Expense[]>('/expenses?my=true')
        setExpenses(data || [])
      } catch (error) {
        console.error('Failed to load expenses:', error)
        setExpenses([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const shown = expenses.filter((e) => isExpenseCompleted(e) === (view === 'completed'))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
          {view === 'completed' ? 'Completed Expenses' : 'Pending Expenses'}
        </h1>
        <Link href="/dashboard/expenses/create">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Expense
          </Button>
        </Link>
      </div>

      <div className="flex gap-2">
        {(['pending', 'completed'] as View[]).map((v) => (
          <Link key={v} href={`/dashboard/expenses/my?view=${v}`}>
            <Button variant={view === v ? 'default' : 'outline'} size="sm">
              {v === 'pending' ? 'Pending' : 'Completed'} ({expenses.filter((e) => isExpenseCompleted(e) === (v === 'completed')).length})
            </Button>
          </Link>
        ))}
      </div>

      <Card className="shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Date</TableHead>
                <TableHead className="font-semibold text-right">Amount</TableHead>
                <TableHead className="font-semibold text-right">Approved Amount</TableHead>
                <TableHead className="font-semibold">Approval Status</TableHead>
                <TableHead className="font-semibold">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-neutral-500">Loading expenses...</TableCell>
                </TableRow>
              ) : shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-neutral-500">
                    {view === 'completed' ? 'No credited or rejected expenses yet.' : 'No pending expenses.'}
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((expense, index) => (
                  <TableRow key={expense._id} className={index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{getExpenseType(expense.category)}</TableCell>
                    <TableCell>{formatDate(expense.date)}</TableCell>
                    <TableCell className="text-right font-medium">{Number(expense.employeeAmount ?? expense.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {expense.approvedAmount != null ? expense.approvedAmount.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${expenseStatusColor(expense.status)}`}>
                        {expenseStatusText(expense)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => setViewing(expense)}
                        aria-label="View expense and bill"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ExpenseView expense={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

export default function MyExpensesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading...</div>}>
      <MyExpensesList />
    </Suspense>
  )
}
