'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Branch = {
  _id: string
  branch_id: string
  branch_name: string
  city?: string
  state?: string
  oem?: string
}

export default function BranchesPage() {
  const [items, setItems] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [form, setForm] = useState({
    branch_id: '',
    branch_name: '',
    city: '',
    state: '',
    oem: 'Hyundai',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Branch[]>('/dms/branches')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load DMS branches', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.branch_id || !form.branch_name) {
      alert('Branch ID and Branch Name are required')
      return
    }
    setSaving(true)
    try {
      await apiRequest<Branch>(editingBranchId ? `/dms/branches/${editingBranchId}` : '/dms/branches', {
        method: editingBranchId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      setOpen(false)
      setEditingBranchId(null)
      setForm({
        branch_id: '',
        branch_name: '',
        city: '',
        state: '',
        oem: 'Hyundai',
      })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create branch')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (branch: Branch) => {
    setEditingBranchId(branch.branch_id)
    setForm({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      city: branch.city || '',
      state: branch.state || '',
      oem: branch.oem || 'Hyundai',
    })
    setOpen(true)
  }

  const handleDelete = async (branchId: string) => {
    if (!confirm(`Delete branch ${branchId}?`)) return
    try {
      await apiRequest(`/dms/branches/${branchId}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete branch')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Branches</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Branch master from the Branch sheet (branch id, name, city, state, OEM).
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-neutral-900 text-white">
          Add Branch
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading branches…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No branches found. Run the DMS seed to import Excel data.</div>
        )}
        {!loading && items.length > 0 && (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">Branch ID</th>
                <th className="px-3 py-2 text-left">Branch Name</th>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-left">State</th>
                <th className="px-3 py-2 text-left">OEM</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-700">{b.branch_id}</td>
                  <td className="px-3 py-2 text-neutral-900">{b.branch_name}</td>
                  <td className="px-3 py-2 text-neutral-700">{b.city || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{b.state || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{b.oem || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(b)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(b.branch_id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingBranchId ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Branch ID *</Label>
              <Input
                value={form.branch_id}
                onChange={(e) => handleChange('branch_id', e.target.value)}
                placeholder="BR-HYD-HN"
                disabled={Boolean(editingBranchId)}
              />
            </div>
            <div>
              <Label>Branch Name *</Label>
              <Input
                value={form.branch_name}
                onChange={(e) => handleChange('branch_name', e.target.value)}
                placeholder="Lakshmi Hyundai - Himayatnagar"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Hyderabad"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="Telangana"
                />
              </div>
            </div>
            <div>
              <Label>OEM</Label>
              <Input
                value={form.oem}
                onChange={(e) => handleChange('oem', e.target.value)}
                placeholder="Hyundai"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setEditingBranchId(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-neutral-900 text-white">
              {saving ? 'Saving…' : editingBranchId ? 'Update Branch' : 'Save Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

