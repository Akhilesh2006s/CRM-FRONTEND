'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { displayRoleName } from '@/lib/roleLabels'

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
  seatVacant?: boolean
}

export default function InactiveEmployeesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [reactivating, setReactivating] = useState<Employee | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', mobile: '', password: '' })
  const [saving, setSaving] = useState(false)

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

  const openReactivate = (employee: Employee) => {
    if (employee.seatVacant) {
      setReactivating(employee)
      setForm({ firstName: '', lastName: '', mobile: '', password: '' })
      return
    }
    void reactivateLeave(employee)
  }

  const reactivateLeave = async (employee: Employee) => {
    try {
      await apiRequest(`/employees/${employee._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: true, inactiveReason: null }),
      })
      toast.success(`${employee.name} reactivated`)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reactivate')
    }
  }

  const saveNewEmployee = async () => {
    if (!reactivating) return
    if (!form.firstName.trim() || !form.mobile.trim()) {
      toast.error('Enter the new employee name and mobile')
      return
    }
    setSaving(true)
    try {
      await apiRequest(`/employees/${reactivating._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          isActive: true,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          mobile: form.mobile.trim(),
          password: form.password || undefined,
        }),
      })
      toast.success('New employee is on this login. Leads and clients are unchanged.')
      setReactivating(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reactivate')
    } finally {
      setSaving(false)
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
                  <td className="py-2 px-3">{e.seatVacant ? 'Vacant' : e.name}</td>
                  <td className="py-2 px-3">{e.email}</td>
                  <td className="py-2 px-3 text-center">{displayMobile(e)}</td>
                  <td className="py-2 px-3 text-center">{displayRoleName(e.role)}</td>
                  <td className="py-2 px-3 text-center">{e.zone || '-'}</td>
                  <td className="py-2 px-3 text-center">{reasonLabel(e.inactiveReason)}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/employees/edit/${e._id}`)}>
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => openReactivate(e)}>
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

      <Dialog open={Boolean(reactivating)} onOpenChange={(open) => !open && setReactivating(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New employee on this login</DialogTitle>
            <DialogDescription>
              {reactivating?.email} keeps its role, leads, and clients. Pay slips, salary, leave, and personal details start empty for the new employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>First name *</Label>
              <Input className="mt-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input className="mt-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <Label>Mobile *</Label>
              <Input className="mt-1" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <Label>Password</Label>
              <Input className="mt-1" type="password" value={form.password} placeholder="Leave blank to keep the current password" onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReactivating(null)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void saveNewEmployee()}>
              {saving ? 'Saving…' : 'Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
