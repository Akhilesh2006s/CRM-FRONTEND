'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

type Employee = {
  _id: string
  name: string
  email: string
  phone?: string
  mobile?: string
  role: string
  department?: string
  zone?: string
  inactiveReason?: string
}

export default function InactiveEmployeesPage() {
  const router = useRouter()
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

  const displayMobile = (e: Employee) =>
    e.mobile || (e.phone && e.phone !== '0' ? e.phone : '') || '-'

  const reasonLabel = (r?: string) => {
    if (r === 'on_leave') return 'On leave'
    if (r === 'manual') return 'Deactivated'
    return r || '-'
  }

  const reactivate = async (id: string, name: string) => {
    if (!confirm(`Reactivate ${name}?`)) return
    try {
      await apiRequest(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: true, inactiveReason: null }),
      })
      toast.success(`${name} reactivated`)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reactivate')
    }
  }

  const filtered = items.filter(
    (e) =>
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      e.email.toLowerCase().includes(q.toLowerCase()) ||
      (e.phone || '').includes(q) ||
      (e.mobile || '').includes(q)
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inactive Employees List</h1>
      <div className="flex gap-2">
        <Input placeholder="Search name/email/mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={load}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-600 border-b bg-neutral-50">
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Email</th>
              <th className="py-2 px-3">Mobile</th>
              <th className="py-2 px-3">Role</th>
              <th className="py-2 px-3">Zone</th>
              <th className="py-2 px-3">Reason</th>
              <th className="py-2 px-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              filtered.map((e) => (
                <tr key={e._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{e.name}</td>
                  <td className="py-2 px-3">{e.email}</td>
                  <td className="py-2 px-3 text-center">{displayMobile(e)}</td>
                  <td className="py-2 px-3 text-center">{e.role}</td>
                  <td className="py-2 px-3 text-center">{e.zone || '-'}</td>
                  <td className="py-2 px-3 text-center">{reasonLabel(e.inactiveReason)}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/employees/edit/${e._id}`)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => reactivate(e._id, e.name)}>
                        Reactivate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="p-4 text-neutral-500">No inactive employees</div>
        )}
      </Card>
    </div>
  )
}
