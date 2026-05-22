'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  inactiveReason?: string
}

export default function ActiveEmployeesPage() {
  const [items, setItems] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    mobile: '',
    role: '',
    department: '',
    cluster: '',
  })
  const [saving, setSaving] = useState(false)
  
  // Get current user to check role
  const currentUser = getCurrentUser()
  const isCoordinator = currentUser?.role === 'Coordinator'
  const isSeniorCoordinator = currentUser?.role === 'Senior Coordinator'
  const shouldHideAction = isCoordinator || isSeniorCoordinator
  
  const availableRoles = ['Executive', 'Trainer', 'Finance Manager', 'Coordinator', 'Senior Coordinator', 'Manager', 'Admin', 'Super Admin', 'Executive Manager']

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

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee)
    setEditForm({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      mobile: employee.mobile || '',
      role: employee.role || '',
      department: employee.department || '',
      cluster: employee.cluster || '',
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingEmployee) return
    
    if (!editForm.name?.trim()) {
      toast.error('Name is required')
      return
    }
    if (!editForm.email?.trim()) {
      toast.error('Email is required')
      return
    }
    if (!editForm.role?.trim()) {
      toast.error('Role is required')
      return
    }
    
    setSaving(true)
    try {
      await apiRequest(`/employees/${editingEmployee._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone || editForm.mobile || '',
          mobile: editForm.mobile || editForm.phone || '',
          role: editForm.role,
          department: editForm.department || undefined,
          cluster: editForm.cluster || undefined,
        }),
      })
      toast.success('Employee updated successfully')
      setEditDialogOpen(false)
      setEditingEmployee(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update employee')
    } finally {
      setSaving(false)
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
                <td className="py-2 px-3 text-center">{e.cluster || '-'}</td>
                {!shouldHideAction && (
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(e)}>
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

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter employee name"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Enter email"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-mobile">Mobile *</Label>
              <Input
                id="edit-mobile"
                type="tel"
                value={editForm.mobile}
                onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                placeholder="Primary mobile number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone (optional)</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Secondary phone"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={editForm.department}
                onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                placeholder="Enter department"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-cluster">Cluster</Label>
              <Input
                id="edit-cluster"
                value={editForm.cluster}
                onChange={(e) => setEditForm({ ...editForm, cluster: e.target.value })}
                placeholder="Enter cluster"
                className="mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}





