'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type Expense = {
  _id: string
  title: string
  amount: number
  category?: string
  status: 'Approved' | 'Pending' | 'Rejected' | string
  date: string
}

function statusColor(status: Expense['status']) {
  switch (status) {
    case 'Approved':
      return 'bg-green-600'
    case 'Pending':
      return 'bg-amber-500'
    case 'Rejected':
      return 'bg-red-600'
    default:
      return 'bg-gray-600'
  }
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Expense[]>('/expenses')
        setExpenses(data)
      } catch (_) {
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Expenses</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {expenses.map((e) => (
          <Card key={e._id} className="p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="text-lg font-medium text-neutral-900">{e.title}</div>
              <span className={`text-xs text-white px-2 py-1 rounded ${statusColor(e.status)}`}>{e.status}</span>
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-4">${e.amount?.toFixed?.(2) ?? e.amount}</div>
            <div className="text-sm text-neutral-600 mt-1">Category: {e.category ?? '-'}</div>
            <div className="text-xs text-neutral-500 mt-2">Date: {new Date(e.date).toLocaleDateString()}</div>
          </Card>
        ))}
        {!loading && expenses.length === 0 && (
          <div className="text-neutral-500">No expenses yet.</div>
        )}
      </div>
    </div>
  )
}


