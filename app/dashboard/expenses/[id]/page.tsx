'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { expenseStatusLabel } from '@/lib/expenseAccess'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'

type ExpenseDetail = {
  _id: string
  title: string
  category: string
  amount: number
  employeeAmount?: number
  approvedAmount?: number
  status: string
  date: string
  employeeRemarks?: string
  managerRemarks?: string
  rejectionReason?: string
  receipt?: string
  ticketReceipt?: string
  transportType?: string
  travelFrom?: string
  travelTo?: string
  approxKms?: number
  gpsDistance?: number
  lodgeName?: string
  city?: string
  stayDate?: string
  restaurantName?: string
  mealDate?: string
  otherExpenseType?: string
  expenseName?: string
  description?: string
  createdBy?: { _id: string; name?: string }
}

export default function ExpenseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const user = getCurrentUser()
  const [expense, setExpense] = useState<ExpenseDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    apiRequest<ExpenseDetail>(`/expenses/${id}`)
      .then(setExpense)
      .catch(() => setExpense(null))
      .finally(() => setLoading(false))
  }, [id])

  const formatDate = (d?: string) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN')
  }

  if (loading) return <div className="p-8 text-neutral-500">Loading…</div>
  if (!expense) return <div className="p-8 text-neutral-500">Expense not found</div>

  const canResubmit =
    expense.status === 'Needs Correction' &&
    user?._id &&
    String(expense.createdBy?._id) === String(user._id)

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h1 className="text-xl font-semibold">Expense details</h1>
      </div>

      <Card className="p-6 space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Status</span>
          <span className="font-medium">{expenseStatusLabel(expense.status)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Category</span>
          <span className="capitalize">{expense.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Amount</span>
          <span>₹{expense.amount}</span>
        </div>
        {expense.approvedAmount != null && (
          <div className="flex justify-between">
            <span className="text-neutral-500">Approved amount</span>
            <span>₹{expense.approvedAmount}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-neutral-500">Date</span>
          <span>{formatDate(expense.date)}</span>
        </div>

        {expense.category === 'travel' && (
          <>
            <div className="flex justify-between">
              <span className="text-neutral-500">Mode</span>
              <span>{expense.transportType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Route</span>
              <span>
                {expense.travelFrom} → {expense.travelTo}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Claimed km</span>
              <span>{expense.approxKms ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">GPS km</span>
              <span>{expense.gpsDistance ?? '—'}</span>
            </div>
          </>
        )}

        {expense.category === 'accommodation' && (
          <>
            <div className="flex justify-between">
              <span className="text-neutral-500">Lodge</span>
              <span>{expense.lodgeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">City</span>
              <span>{expense.city}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Stay date</span>
              <span>{formatDate(expense.stayDate)}</span>
            </div>
          </>
        )}

        {expense.category === 'food' && (
          <>
            <div className="flex justify-between">
              <span className="text-neutral-500">Restaurant</span>
              <span>{expense.restaurantName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Meal date</span>
              <span>{formatDate(expense.mealDate)}</span>
            </div>
          </>
        )}

        {expense.category === 'other' && (
          <>
            <div className="flex justify-between">
              <span className="text-neutral-500">Type</span>
              <span>{expense.otherExpenseType}</span>
            </div>
            {expense.description && (
              <div>
                <span className="text-neutral-500">Description</span>
                <p className="mt-1">{expense.description}</p>
              </div>
            )}
          </>
        )}

        {expense.employeeRemarks && (
          <div>
            <span className="text-neutral-500">Your remarks</span>
            <p className="mt-1">{expense.employeeRemarks}</p>
          </div>
        )}
        {expense.managerRemarks && (
          <div>
            <span className="text-neutral-500">Manager remarks</span>
            <p className="mt-1">{expense.managerRemarks}</p>
          </div>
        )}
        {expense.rejectionReason && (
          <div className="text-amber-800 bg-amber-50 p-3 rounded-md">
            {expense.rejectionReason}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          {expense.receipt && (
            <a
              href={resolveUploadUrl(expense.receipt)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              View bill
            </a>
          )}
          {expense.ticketReceipt && (
            <a
              href={resolveUploadUrl(expense.ticketReceipt)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              View ticket
            </a>
          )}
        </div>

        {canResubmit && (
          <Button asChild className="mt-4">
            <Link href={`/dashboard/expenses/resubmit/${expense._id}`}>Edit & resubmit</Link>
          </Button>
        )}
      </Card>
    </div>
  )
}
