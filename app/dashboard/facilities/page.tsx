'use client'

import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Facility = {
  _id: string
  facility_id: string
  dealer_group_id?: string
  branch_id?: string
  oem?: string
  lender_name?: string
  interest_rate_apr?: number
  funding_cap_pct?: number
  funding_cap_amount_inr?: number
  start_date?: string
  end_date?: string
  is_active?: string
}

export default function FacilitiesPage() {
  const [items, setItems] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null)
  const [form, setForm] = useState({
    facility_id: '',
    branch_id: '',
    lender_name: '',
    interest_rate_apr: '',
    funding_cap_pct: '',
    funding_cap_amount_inr: '',
    start_date: '',
    end_date: '',
    is_active: 'Y',
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Facility[]>('/dms/facilities')
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Failed to load DMS facilities', e)
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
    if (!form.facility_id || !form.branch_id || !form.lender_name) {
      alert('Facility ID, Branch, and Lender are required')
      return
    }
    setSaving(true)
    try {
      await apiRequest<Facility>(editingFacilityId ? `/dms/facilities/${editingFacilityId}` : '/dms/facilities', {
        method: editingFacilityId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          interest_rate_apr: form.interest_rate_apr ? Number(form.interest_rate_apr) : undefined,
          funding_cap_pct: form.funding_cap_pct ? Number(form.funding_cap_pct) : undefined,
          funding_cap_amount_inr: form.funding_cap_amount_inr ? Number(form.funding_cap_amount_inr) : undefined,
        }),
      })
      setOpen(false)
      setEditingFacilityId(null)
      setForm({
        facility_id: '',
        branch_id: '',
        lender_name: '',
        interest_rate_apr: '',
        funding_cap_pct: '',
        funding_cap_amount_inr: '',
        start_date: '',
        end_date: '',
        is_active: 'Y',
      })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to create facility')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (facility: Facility) => {
    setEditingFacilityId(facility.facility_id)
    setForm({
      facility_id: facility.facility_id,
      branch_id: facility.branch_id || '',
      lender_name: facility.lender_name || '',
      interest_rate_apr: facility.interest_rate_apr ? String(facility.interest_rate_apr) : '',
      funding_cap_pct: facility.funding_cap_pct ? String(facility.funding_cap_pct) : '',
      funding_cap_amount_inr: facility.funding_cap_amount_inr ? String(facility.funding_cap_amount_inr) : '',
      start_date: facility.start_date ? new Date(facility.start_date).toISOString().slice(0, 10) : '',
      end_date: facility.end_date ? new Date(facility.end_date).toISOString().slice(0, 10) : '',
      is_active: facility.is_active || 'Y',
    })
    setOpen(true)
  }

  const handleDelete = async (facilityId: string) => {
    if (!confirm(`Delete facility ${facilityId}?`)) return
    try {
      await apiRequest(`/dms/facilities/${facilityId}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete facility')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">FloorPlan Facilities</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Bank floorplan limits for each branch (facility id, lender, rate, caps, dates) from the FloorPlan_Facility
            sheet.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-neutral-900 text-white">
          Add Facility
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-500">Loading facilities…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">
            No facilities found. Run the DMS seed to import Excel data or add a new facility.
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
                <th className="px-3 py-2 text-left">Facility ID</th>
                <th className="px-3 py-2 text-left">Branch</th>
                <th className="px-3 py-2 text-left">Lender</th>
                <th className="px-3 py-2 text-left">Rate (APR)</th>
                <th className="px-3 py-2 text-left">Cap %</th>
                <th className="px-3 py-2 text-right">Cap Amount</th>
                <th className="px-3 py-2 text-left">Start</th>
                <th className="px-3 py-2 text-left">End</th>
                <th className="px-3 py-2 text-left">Active</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f._id} className="border-b last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{f.facility_id}</td>
                  <td className="px-3 py-2 text-neutral-700">{f.branch_id || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">{f.lender_name || '-'}</td>
                  <td className="px-3 py-2 text-neutral-700">
                    {f.interest_rate_apr ? `${(f.interest_rate_apr * 100).toFixed(2)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {f.funding_cap_pct ? `${(f.funding_cap_pct * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.funding_cap_amount_inr
                      ? f.funding_cap_amount_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                      : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {f.start_date ? new Date(f.start_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {f.end_date ? new Date(f.end_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{f.is_active || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(f)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(f.facility_id)}>
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
            <DialogTitle>{editingFacilityId ? 'Edit Facility' : 'Add Facility'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Facility ID *</Label>
                <Input
                  value={form.facility_id}
                  onChange={(e) => handleChange('facility_id', e.target.value)}
                  placeholder="FP-HDFC-HYD-HN-01"
                  disabled={Boolean(editingFacilityId)}
                />
              </div>
              <div>
                <Label>Branch *</Label>
                <Input
                  value={form.branch_id}
                  onChange={(e) => handleChange('branch_id', e.target.value)}
                  placeholder="BR-HYD-HN"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Lender *</Label>
                <Input
                  value={form.lender_name}
                  onChange={(e) => handleChange('lender_name', e.target.value)}
                  placeholder="HDFC Bank"
                />
              </div>
              <div>
                <Label>Rate (APR, decimal)</Label>
                <Input
                  value={form.interest_rate_apr}
                  onChange={(e) => handleChange('interest_rate_apr', e.target.value)}
                  placeholder="0.1125"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Cap % (decimal)</Label>
                <Input
                  value={form.funding_cap_pct}
                  onChange={(e) => handleChange('funding_cap_pct', e.target.value)}
                  placeholder="0.9"
                />
              </div>
              <div>
                <Label>Cap Amount (₹)</Label>
                <Input
                  value={form.funding_cap_amount_inr}
                  onChange={(e) => handleChange('funding_cap_amount_inr', e.target.value)}
                  placeholder="9000000"
                />
              </div>
              <div>
                <Label>Active Flag</Label>
                <Input
                  value={form.is_active}
                  onChange={(e) => handleChange('is_active', e.target.value)}
                  placeholder="Y / N"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setEditingFacilityId(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="bg-neutral-900 text-white">
              {saving ? 'Saving…' : editingFacilityId ? 'Update Facility' : 'Save Facility'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
