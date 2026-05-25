'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
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
  cluster?: string
  zone?: string
  inactiveReason?: string
}

export default function ActiveEmployeesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  // Get current user to check role
  const currentUser = getCurrentUser()
  const isCoordinator = currentUser?.role === 'Coordinator'
  const isSeniorCoordinator = currentUser?.role === 'Senior Coordinator'
  const shouldHideAction = isCoordinator || isSeniorCoordinator
  
  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const resetPassword = async (id: string, name: string) => {
    if (!confirm(`Reset password for ${name} to "Password123"?`)) return
    try {
      await apiRequest(`/employees/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({}) })
      toast.success(`Password reset to Password123 for ${name}`)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset password')
    }
  }

  const displayMobile = (e: Employee) => e.mobile || (e.phone && e.phone !== '0' ? e.phone : '') || '-'

  const deactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate ${name}?`)) return
    try {
      await apiRequest(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: false, inactiveReason: 'manual' }),
      })
      toast.success(`${name} deactivated`)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to deactivate')
    }
  }

  const filtered = items.filter(e =>
    e.name.toLowerCase().includes(q.toLowerCase()) ||
    e.email.toLowerCase().includes(q.toLowerCase()) ||
    (e.phone || '').includes(q) ||
    (e.mobile || '').includes(q) ||
    (e.cluster || '').toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Employees List</h1>
      <div className="flex gap-2">
        <Input placeholder="Search name/email/mobile/cluster" value={q} onChange={(e) => setQ(e.target.value)} />
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
              <th className="py-2 px-3">Department</th>
              <th className="py-2 px-3">Zone</th>
              <th className="py-2 px-3">Cluster</th>
              {!shouldHideAction && <th className="py-2 px-3">Action</th>}
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.map((e) => (
              <tr key={e._id} className="border-b last:border-0">
                <td className="py-2 px-3">{e.name}</td>
                <td className="py-2 px-3">{e.email}</td>
                <td className="py-2 px-3 text-center">{displayMobile(e)}</td>
                <td className="py-2 px-3 text-center">{e.role}</td>
                <td className="py-2 px-3 text-center">{e.department || '-'}</td>
                <td className="py-2 px-3 text-center">{e.zone || '-'}</td>
                <td className="py-2 px-3 text-center">{e.cluster || '-'}</td>
                {!shouldHideAction && (
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/employees/edit/${e._id}`)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => resetPassword(e._id, e.name)}>
                        Reset Password
                      </Button>
                      <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => deactivate(e._id, e.name)}>
                        Deactivate
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="p-4 text-neutral-500">No active employees</div>}
      </Card>

    </div>
  )
}





