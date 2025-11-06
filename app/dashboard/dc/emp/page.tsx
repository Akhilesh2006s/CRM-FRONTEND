'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Emp = { _id: string; name: string }
type EmpDC = { _id: string; emp_dc_code: string; employee_id: Emp | string; kit_type: string; distribution_date: string; status: string }

export default function EmployeeDCPage() {
  const [list, setList] = useState<EmpDC[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<EmpDC[]>(`/emp-dc/list`)
      setList(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await apiRequest(`/emp-dc/create`, { method: 'POST', body: JSON.stringify(form) })
      setForm({ employee_id: '', kit_type: 'Sales', distribution_date: '', expected_return_date: '' })
      load()
    } catch (e) {
      alert('Failed to create EMP DC. Ensure you are logged in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">EMP DC (Employee Kits)</h1>
      <Card className="p-4 space-y-4 text-neutral-900">
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Employee ID</Label>
            <Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="User ObjectId" required />
          </div>
          <div>
            <Label>Kit Type</Label>
            <Select value={form.kit_type} onValueChange={(v) => setForm({ ...form, kit_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Training">Training</SelectItem>
                <SelectItem value="Field">Field</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Distribution Date</Label>
            <Input type="date" value={form.distribution_date} onChange={(e) => setForm({ ...form, distribution_date: e.target.value })} required />
          </div>
          <div>
            <Label>Expected Return</Label>
            <Input type="date" value={form.expected_return_date} onChange={(e) => setForm({ ...form, expected_return_date: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create Kit'}</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Code</th>
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3">Kit</th>
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((k) => (
                <tr key={k._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{k.emp_dc_code}</td>
                  <td className="py-2 px-3">{typeof k.employee_id === 'string' ? k.employee_id : k.employee_id?.name}</td>
                  <td className="py-2 px-3 text-center">{k.kit_type}</td>
                  <td className="py-2 px-3 text-center">{k.distribution_date ? new Date(k.distribution_date).toLocaleDateString() : '-'}</td>
                  <td className="py-2 px-3 text-center">{k.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

