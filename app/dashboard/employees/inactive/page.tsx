'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

type Employee = { _id: string; name: string; email: string; phone?: string; role: string; department?: string }

export default function InactiveEmployeesPage() {
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=false')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(e => e.name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()) || (e.phone || '').includes(q))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inactive Employees List</h1>
      <div className="flex gap-2">
        <Input placeholder="Search name/email/phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={load}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-600 border-b bg-neutral-50">
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Email</th>
              <th className="py-2 px-3">Phone</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Department</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.map((e) => (
              <tr key={e._id} className="border-b last:border-0">
                <td className="py-2 px-3">{e.name}</td>
                <td className="py-2 px-3">{e.email}</td>
                <td className="py-2 px-3 text-center">{e.phone || '-'}</td>
                <td className="py-2 px-3 text-center">{e.role}</td>
                <td className="py-2 px-3 text-center">{e.department || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="p-4 text-neutral-500">No inactive employees</div>}
      </Card>
    </div>
  )
}








