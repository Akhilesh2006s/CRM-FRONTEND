'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Employee = {
  _id: string
  name?: string
  email?: string
  role?: string
  yearlySalary?: number
  monthlyTakeHome?: number
}

export default function SalaryPage() {
  const [rows, setRows] = useState<Employee[]>([])
  const [drafts, setDrafts] = useState<Record<string, { yearly: string; monthly: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const data = await apiRequest<Employee[]>('/employees?isActive=true')
        const list = Array.isArray(data) ? data : []
        setRows(list)
        const next: Record<string, { yearly: string; monthly: string }> = {}
        list.forEach((row) => {
          next[row._id] = {
            yearly: String(row.yearlySalary || ''),
            monthly: String(row.monthlyTakeHome || ''),
          }
        })
        setDrafts(next)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load employees')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async (id: string) => {
    const draft = drafts[id]
    setSaving(id)
    try {
      await apiRequest(`/hr/employees/${id}/salary`, {
        method: 'PUT',
        body: JSON.stringify({
          yearlySalary: Number(draft?.yearly || 0),
          monthlyTakeHome: Number(draft?.monthly || 0),
        }),
      })
      toast.success('Salary saved. This month’s pay slip was updated.')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save salary')
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Salary</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Set the yearly salary and monthly take-home for each employee. Saving updates the current month pay slip.
        </p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Role</th>
                <th className="py-2 px-3 text-left">Yearly salary</th>
                <th className="py-2 px-3 text-left">Monthly take-home</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.name || '—'}</div>
                    <div className="text-xs text-neutral-500">{row.email}</div>
                  </td>
                  <td className="py-2 px-3">{row.role || '—'}</td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      min="0"
                      className="bg-white"
                      value={drafts[row._id]?.yearly || ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row._id]: { yearly: e.target.value, monthly: prev[row._id]?.monthly || '' },
                        }))
                      }
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      min="0"
                      className="bg-white"
                      value={drafts[row._id]?.monthly || ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row._id]: { yearly: prev[row._id]?.yearly || '', monthly: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td className="py-2 px-3">
                    <Button size="sm" disabled={saving === row._id} onClick={() => void save(row._id)}>
                      {saving === row._id ? 'Saving…' : 'Save'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
