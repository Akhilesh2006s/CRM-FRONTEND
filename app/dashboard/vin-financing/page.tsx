'use client'

import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type VinFinance = {
  _id: string
  vin: string
  facility_id?: string
  drawdown_date?: string
  financed_principal_inr?: number
  outstanding_principal_inr?: number
  last_curtailment_date?: string
  status?: string
}

export default function VinFinancingPage() {
  const [items, setItems] = useState<VinFinance[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingVin, setEditingVin] = useState<string | null>(null)
  const [form, setForm] = useState({
    vin: '',
    facility_id: '',
    drawdown_date: '',
    financed_principal_inr: '',
    outstanding_principal_inr: '',
    last_curtailment_date: '',
    status: 'Active',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<VinFinance[]>('/dms/vin-financing')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load DMS VIN financing', e)
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
    if (!form.vin || !form.facility_id) {
      alert('VIN and Facility are required')
      return
    }
    setSaving(true)
    try {
      await apiRequest<VinFinance>(editingVin ? `/dms/vin-financing/${editingVin}` : '/dms/vin-financing', {
        method: editingVin ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          financed_principal_inr: form.financed_principal_inr ? Number(form.financed_principal_inr) : undefined,
          outstanding_principal_inr: form.outstanding_principal_inr
            ? Number(form.outstanding_principal_inr)
            : undefined,
        }),
      })
      setOpen(false)
      setEditingVin(null)
      setForm({
        vin: '',
        facility_id: '',
        drawdown_date: '',
        financed_principal_inr: '',
        outstanding_principal_inr: '',
        last_curtailment_date: '',
        status: 'Active',
      })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create VIN financing row')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: VinFinance) => {
    setEditingVin(item.vin)
    setForm({
      vin: item.vin,
      facility_id: item.facility_id || '',
      drawdown_date: item.drawdown_date ? new Date(item.drawdown_date).toISOString().slice(0, 10) : '',
      financed_principal_inr: item.financed_principal_inr ? String(item.financed_principal_inr) : '',
      outstanding_principal_inr: item.outstanding_principal_inr ? String(item.outstanding_principal_inr) : '',
      last_curtailment_date: item.last_curtailment_date ? new Date(item.last_curtailment_date).toISOString().slice(0, 10) : '',
      status: item.status || 'Active',
    })
    setOpen(true)
  }

  const handleDelete = async (vin: string) => {
    if (!confirm(`Delete VIN financing record for ${vin}?`)) return
    try {
      await apiRequest(`/dms/vin-financing/${vin}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete VIN financing row')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">VIN Financing</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Per-VIN funding position (drawdown date, financed principal, outstanding principal, status) from the
            VIN_Financing sheet.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-neutral-900 text-white">
          Add VIN Finance
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading VIN financing data…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">
            No VIN financing rows found. Run the DMS seed to import Excel data or add a new row.
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">VIN</th>
                <th className="px-3 py-2 text-left">Facility</th>
                <th className="px-3 py-2 text-left">Drawdown</th>
                <th className="px-3 py-2 text-right">Financed</th>
                <th className="px-3 py-2 text-right">Outstanding</th>
                <th className="px-3 py-2 text-left">Last Curtailment</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{v.vin}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.facility_id || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    {v.drawdown_date ? new Date(v.drawdown_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.financed_principal_inr
                      ? v.financed_principal_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.outstanding_principal_inr
                      ? v.outstanding_principal_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {v.last_curtailment_date
                      ? new Date(v.last_curtailment_date).toLocaleDateString('en-IN')
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{v.status || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(v.vin)}>
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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingVin ? 'Edit VIN Financing' : 'Add VIN Financing'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>VIN *</Label>
                <Input
                  value={form.vin}
                  onChange={(e) => handleChange('vin', e.target.value)}
                  placeholder="MALH0D2DC9IS0001"
                  disabled={Boolean(editingVin)}
                />
              </div>
              <div>
                <Label>Facility ID *</Label>
                <Input
                  value={form.facility_id}
                  onChange={(e) => handleChange('facility_id', e.target.value)}
                  placeholder="FP-HDFC-HYD-HN-01"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Drawdown Date</Label>
                <Input
                  type="date"
                  value={form.drawdown_date}
                  onChange={(e) => handleChange('drawdown_date', e.target.value)}
                />
              </div>
              <div>
                <Label>Last Curtailment Date</Label>
                <Input
                  type="date"
                  value={form.last_curtailment_date}
                  onChange={(e) => handleChange('last_curtailment_date', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Financed (₹)</Label>
                <Input
                  value={form.financed_principal_inr}
                  onChange={(e) => handleChange('financed_principal_inr', e.target.value)}
                  placeholder="1400000"
                />
              </div>
              <div>
                <Label>Outstanding (₹)</Label>
                <Input
                  value={form.outstanding_principal_inr}
                  onChange={(e) => handleChange('outstanding_principal_inr', e.target.value)}
                  placeholder="1400000"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Input
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                placeholder="Active / Closed / Overdue"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setEditingVin(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-neutral-900 text-white">
              {saving ? 'Saving…' : editingVin ? 'Update VIN Financing' : 'Save VIN Financing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
