'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Vehicle = {
  _id: string
  vehicle_id: string
  vin: string
  stock_no?: string
  oem?: string
  model?: string
  variant?: string
  variant_id?: string
  fuel_type?: string
  transmission?: string
  purchase_date?: string
  branch_id?: string
  inventory_status?: string
  cost_price_inr?: number
  mrp_inr?: number
  current_asking_price_inr?: number
}

export default function VehiclesPage() {
  const [items, setItems] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [form, setForm] = useState({
    vehicle_id: '',
    vin: '',
    model: '',
    variant: '',
    branch_id: '',
    inventory_status: 'In Stock',
    mrp_inr: '',
    cost_price_inr: '',
    current_asking_price_inr: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Vehicle[]>('/dms/vehicles')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load DMS vehicles', e)
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
    if (!form.vehicle_id || !form.vin || !form.model) {
      alert('Vehicle ID, VIN, and Model are required')
      return
    }
    setSaving(true)
    try {
      await apiRequest<Vehicle>(editingVehicleId ? `/dms/vehicles/${editingVehicleId}` : '/dms/vehicles', {
        method: editingVehicleId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          mrp_inr: form.mrp_inr ? Number(form.mrp_inr) : undefined,
          cost_price_inr: form.cost_price_inr ? Number(form.cost_price_inr) : undefined,
          current_asking_price_inr: form.current_asking_price_inr ? Number(form.current_asking_price_inr) : undefined,
        }),
      })
      setOpen(false)
      setEditingVehicleId(null)
      setForm({
        vehicle_id: '',
        vin: '',
        model: '',
        variant: '',
        branch_id: '',
        inventory_status: 'In Stock',
        mrp_inr: '',
        cost_price_inr: '',
        current_asking_price_inr: '',
      })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create vehicle')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.vehicle_id)
    setForm({
      vehicle_id: vehicle.vehicle_id,
      vin: vehicle.vin,
      model: vehicle.model || '',
      variant: vehicle.variant || '',
      branch_id: vehicle.branch_id || '',
      inventory_status: vehicle.inventory_status || 'In Stock',
      mrp_inr: vehicle.mrp_inr ? String(vehicle.mrp_inr) : '',
      cost_price_inr: vehicle.cost_price_inr ? String(vehicle.cost_price_inr) : '',
      current_asking_price_inr: vehicle.current_asking_price_inr ? String(vehicle.current_asking_price_inr) : '',
    })
    setOpen(true)
  }

  const handleDelete = async (vehicleId: string) => {
    if (!confirm(`Delete vehicle ${vehicleId}?`)) return
    try {
      await apiRequest(`/dms/vehicles/${vehicleId}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete vehicle')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Vehicles</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Vehicle master from Lakshmi Hyundai DMS seed (stock no, VIN, model, variant, branch, inventory status,
            pricing).
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-neutral-900 text-white">
          Add Vehicle
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading vehicles…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No vehicles found. Run the DMS seed or add a new vehicle.</div>
        )}
        {!loading && items.length > 0 && (
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">Vehicle ID</th>
                <th className="px-3 py-2 text-left">VIN</th>
                <th className="px-3 py-2 text-left">Stock No</th>
                <th className="px-3 py-2 text-left">Model / Variant</th>
                <th className="px-3 py-2 text-left">OEM</th>
                <th className="px-3 py-2 text-left">Fuel / Transmission</th>
                <th className="px-3 py-2 text-left">Branch</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Purchase Date</th>
                <th className="px-3 py-2 text-right">MRP</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Asking</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{v.vehicle_id}</td>
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{v.vin}</td>
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{v.stock_no || '-'}</td>
                  <td className="px-3 py-2 text-neutral-900">
                    <div>{v.model || '-'}</div>
                    <div className="text-[11px] text-neutral-500">{v.variant || '-'}</div>
                    <div className="text-[10px] font-mono text-neutral-400">{v.variant_id || ''}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{v.oem || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    <div>{v.fuel_type || '-'}</div>
                    <div className="text-[11px] text-neutral-500">{v.transmission || '-'}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{v.branch_id || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{v.inventory_status || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    {v.purchase_date ? new Date(v.purchase_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.mrp_inr ? v.mrp_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.cost_price_inr ? v.cost_price_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.current_asking_price_inr
                      ? v.current_asking_price_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                      : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(v)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(v.vehicle_id)}>
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
            <DialogTitle>{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Vehicle ID *</Label>
                <Input
                  value={form.vehicle_id}
                  onChange={(e) => handleChange('vehicle_id', e.target.value)}
                  placeholder="VEH-0001"
                  disabled={Boolean(editingVehicleId)}
                />
              </div>
              <div>
                <Label>VIN *</Label>
                <Input
                  value={form.vin}
                  onChange={(e) => handleChange('vin', e.target.value)}
                  placeholder="MALH0D2DC9IS0001"
                  disabled={Boolean(editingVehicleId)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Model *</Label>
                <Input
                  value={form.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  placeholder="Creta"
                />
              </div>
              <div>
                <Label>Variant</Label>
                <Input
                  value={form.variant}
                  onChange={(e) => handleChange('variant', e.target.value)}
                  placeholder="SX Petrol DCT"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Branch</Label>
                <Input
                  value={form.branch_id}
                  onChange={(e) => handleChange('branch_id', e.target.value)}
                  placeholder="BR-HYD-HN"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Input
                  value={form.inventory_status}
                  onChange={(e) => handleChange('inventory_status', e.target.value)}
                  placeholder="In Stock / Sold / Reserved"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>MRP (₹)</Label>
                <Input
                  value={form.mrp_inr}
                  onChange={(e) => handleChange('mrp_inr', e.target.value)}
                  placeholder="1700000"
                />
              </div>
              <div>
                <Label>Cost (₹)</Label>
                <Input
                  value={form.cost_price_inr}
                  onChange={(e) => handleChange('cost_price_inr', e.target.value)}
                  placeholder="1535000"
                />
              </div>
              <div>
                <Label>Asking (₹)</Label>
                <Input
                  value={form.current_asking_price_inr}
                  onChange={(e) => handleChange('current_asking_price_inr', e.target.value)}
                  placeholder="1690000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setEditingVehicleId(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-neutral-900 text-white">
              {saving ? 'Saving…' : editingVehicleId ? 'Update Vehicle' : 'Save Vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

