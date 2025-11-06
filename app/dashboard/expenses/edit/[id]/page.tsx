'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Expense = {
  _id: string
  title: string
  amount: number
  category: string
  description?: string
  date: string
  employeeId?: {
    _id: string
    name: string
  }
  trainerId?: {
    _id: string
    name: string
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

export default function EditExpensePage() {
  const router = useRouter()
  const params = useParams()
  const expenseId = params.id as string

  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])

  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: '',
    description: '',
    date: '',
    employeeId: 'none',
    trainerId: 'none',
    pendingMonth: 'none',
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
    if (expenseId) {
      loadExpense()
    }
  }, [expenseId])

  const loadExpense = async () => {
    setLoading(true)
    try {
      const expense = await apiRequest<Expense>(`/expenses/${expenseId}`)
      
      if (expense) {
        setExpense(expense)
        setForm({
          title: expense.title || '',
          amount: expense.amount?.toString() || '',
          category: expense.category || '',
          description: expense.description || '',
          date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : '',
          employeeId: expense.employeeId?._id || 'none',
          trainerId: expense.trainerId?._id || 'none',
          pendingMonth: expense.pendingMonth || 'none',
        })
      } else {
        toast.error('Expense not found')
        router.push('/dashboard/expenses/pending')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load expense')
      router.push('/dashboard/expenses/pending')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      await apiRequest(`/expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title,
          amount: parseFloat(form.amount),
          category: form.category,
          description: form.description,
          date: form.date,
          employeeId: form.employeeId && form.employeeId !== 'none' ? form.employeeId : undefined,
          trainerId: form.trainerId && form.trainerId !== 'none' ? form.trainerId : undefined,
          pendingMonth: form.pendingMonth && form.pendingMonth !== 'none' ? form.pendingMonth : undefined,
        }),
      })

      toast.success('Expense updated successfully')
      router.push('/dashboard/expenses/pending')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update expense')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8 text-neutral-500">Loading expense...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Expense</h1>
      </div>

      <Card className="p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
                className="bg-white"
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm({ ...form, category: value })}
                required
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Salary">Salary</SelectItem>
                  <SelectItem value="Rent">Rent</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employeeId">Employee</Label>
              <Select
                value={form.employeeId}
                onValueChange={(value) => setForm({ ...form, employeeId: value, trainerId: 'none' })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp._id} value={emp._id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trainerId">Trainer</Label>
              <Select
                value={form.trainerId}
                onValueChange={(value) => setForm({ ...form, trainerId: value, employeeId: 'none' })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {trainers.map((trainer) => (
                    <SelectItem key={trainer._id} value={trainer._id}>
                      {trainer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="bg-white"
              />
            </div>

            <div>
              <Label htmlFor="pendingMonth">Pending Month</Label>
              <Select
                value={form.pendingMonth}
                onValueChange={(value) => setForm({ ...form, pendingMonth: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="January">January</SelectItem>
                  <SelectItem value="February">February</SelectItem>
                  <SelectItem value="March">March</SelectItem>
                  <SelectItem value="April">April</SelectItem>
                  <SelectItem value="May">May</SelectItem>
                  <SelectItem value="June">June</SelectItem>
                  <SelectItem value="July">July</SelectItem>
                  <SelectItem value="August">August</SelectItem>
                  <SelectItem value="September">September</SelectItem>
                  <SelectItem value="October">October</SelectItem>
                  <SelectItem value="November">November</SelectItem>
                  <SelectItem value="December">December</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-white"
              rows={4}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? 'Updating...' : 'Update Expense'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/expenses/pending')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

