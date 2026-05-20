'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Variant = {
  _id: string
  variant_id: string
  model: string
  variant: string
  fuel_type?: string
  transmission?: string
  oem?: string
}

export default function VariantsPage() {
  const [items, setItems] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [form, setForm] = useState({
    variant_id: '',
    model: '',
    variant: '',
    fuel_type: '',
    transmission: '',
    oem: 'Hyundai',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Variant[]>('/dms/variants')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load DMS variants', e)
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
    if (!form.variant_id || !form.model || !form.variant) {
      alert('Variant ID, Model, and Variant are required')
      return
    }
    setSaving(true)
    try {
      await apiRequest<Variant>(editingVariantId ? `/dms/variants/${editingVariantId}` : '/dms/variants', {
        method: editingVariantId ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      })
      setOpen(false)
      setEditingVariantId(null)
      setForm({
        variant_id: '',
        model: '',
        variant: '',
        fuel_type: '',
        transmission: '',
        oem: 'Hyundai',
      })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create variant')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (variant: Variant) => {
    setEditingVariantId(variant.variant_id)
    setForm({
      variant_id: variant.variant_id,
      model: variant.model,
      variant: variant.variant,
      fuel_type: variant.fuel_type || '',
      transmission: variant.transmission || '',
      oem: variant.oem || 'Hyundai',
    })
    setOpen(true)
  }

  const handleDelete = async (variantId: string) => {
    if (!confirm(`Delete variant ${variantId}?`)) return
    try {
      await apiRequest(`/dms/variants/${variantId}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete variant')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Variants</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Variant master from the Variant sheet (variant id, model, fuel, transmission, OEM).
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-neutral-900 text-white">
          Add Variant
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading variants…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">
            No variants found. Run the DMS seed to import Excel data or add a new variant.
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">Variant ID</th>
                <th className="px-3 py-2 text-left">Model</th>
                <th className="px-3 py-2 text-left">Variant</th>
                <th className="px-3 py-2 text-left">Fuel</th>
                <th className="px-3 py-2 text-left">Transmission</th>
                <th className="px-3 py-2 text-left">OEM</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{v.variant_id}</td>
                  <td className="px-3 py-2 text-neutral-900">{v.model}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.variant}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.fuel_type || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.transmission || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.oem || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(v.variant_id)}>
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
            <DialogTitle>{editingVariantId ? 'Edit Variant' : 'Add Variant'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Variant ID *</Label>
              <Input
                value={form.variant_id}
                onChange={(e) => handleChange('variant_id', e.target.value)}
                placeholder="VAR-CRETA-SX-P"
                disabled={Boolean(editingVariantId)}
              />
            </div>
            <div>
              <Label>Model *</Label>
              <Input
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="Creta"
              />
            </div>
            <div>
              <Label>Variant *</Label>
              <Input
                value={form.variant}
                onChange={(e) => handleChange('variant', e.target.value)}
                placeholder="SX (O) Petrol AT"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Fuel</Label>
                <Input
                  value={form.fuel_type}
                  onChange={(e) => handleChange('fuel_type', e.target.value)}
                  placeholder="Petrol"
                />
              </div>
              <div>
                <Label>Transmission</Label>
                <Input
                  value={form.transmission}
                  onChange={(e) => handleChange('transmission', e.target.value)}
                  placeholder="AT / MT / DCT"
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
                setEditingVariantId(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-neutral-900 text-white"
            >
              {saving ? 'Saving…' : editingVariantId ? 'Update Variant' : 'Save Variant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

