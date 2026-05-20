'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type WcxExposure = {
  exposure_id: string
  vehicle_id: string
  vin: string
  model: string
  variant_id: string
  branch_id: string
  ageing_bucket: string
  risk_tag: string
  inventory_status: string
  facility_id: string
  working_capital_locked_inr: number
  interest_exposure_inr: number
  mrp_inr: number
  cost_price_inr: number
  recommended_discount_pct: number
  recommended_discount_inr: number
  recommended_price_inr: number
  margin_pct_after_discount: number
  critical_flag?: string
}

export default function WcxPage() {
  const [items, setItems] = useState<WcxExposure[]>([])
  const [loading, setLoading] = useState(true)
  const [modelFilter, setModelFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingExposureId, setEditingExposureId] = useState<string | null>(null)
  const [form, setForm] = useState({
    risk_tag: '',
    ageing_bucket: '',
    recommended_discount_pct: '',
    recommended_price_inr: '',
    margin_pct_after_discount: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (modelFilter) params.append('model', modelFilter)
      if (riskFilter) params.append('risk_tag', riskFilter)
      if (branchFilter) params.append('branch_id', branchFilter)
      params.append('limit', '200')

      const data = await apiRequest<WcxExposure[]>(`/wcx?${params.toString()}`)
      const list = Array.isArray(data) ? data : []
      setItems(list)
    } catch (e) {
      console.error('Failed to load WCX exposures', e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const models = Array.from(new Set(items.map((i) => i.model))).sort()
  const branches = Array.from(new Set(items.map((i) => i.branch_id))).sort()

  const summary = {
    total: items.length,
    workingCapital: items.reduce((s, i) => s + (i.working_capital_locked_inr || 0), 0),
    interestExposure: items.reduce((s, i) => s + (i.interest_exposure_inr || 0), 0),
  }

  const startEdit = (row: WcxExposure) => {
    setEditingExposureId(row.exposure_id)
    setForm({
      risk_tag: row.risk_tag || '',
      ageing_bucket: row.ageing_bucket || '',
      recommended_discount_pct:
        row.recommended_discount_pct !== undefined ? String(row.recommended_discount_pct) : '',
      recommended_price_inr: row.recommended_price_inr !== undefined ? String(row.recommended_price_inr) : '',
      margin_pct_after_discount:
        row.margin_pct_after_discount !== undefined ? String(row.margin_pct_after_discount) : '',
    })
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!editingExposureId) return
    setSaving(true)
    try {
      await apiRequest(`/wcx/${editingExposureId}`, {
        method: 'PUT',
        body: JSON.stringify({
          risk_tag: form.risk_tag,
          ageing_bucket: form.ageing_bucket,
          recommended_discount_pct: form.recommended_discount_pct ? Number(form.recommended_discount_pct) : undefined,
          recommended_price_inr: form.recommended_price_inr ? Number(form.recommended_price_inr) : undefined,
          margin_pct_after_discount: form.margin_pct_after_discount ? Number(form.margin_pct_after_discount) : undefined,
        }),
      })
      setEditOpen(false)
      setEditingExposureId(null)
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to update WCX exposure')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (exposureId: string) => {
    if (!confirm(`Delete exposure ${exposureId}?`)) return
    try {
      await apiRequest(`/wcx/${exposureId}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete WCX exposure')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">WCX After Discounting</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Working-capital exposure and recommended pricing for each VIN from the Lakshmi Hyundai pricing seed.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 items-end">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Model</label>
            <Select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Risk Tag</label>
            <Select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="">All</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Branch</label>
            <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={load}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors w-full"
            >
              {loading ? 'Loading...' : 'Apply Filters'}
            </button>
            <button
              onClick={() => {
                setModelFilter('')
                setRiskFilter('')
                setBranchFilter('')
                load()
              }}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 rounded-md border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-neutral-500">Vehicles in scope</div>
            <div className="text-xl font-semibold text-neutral-900">{summary.total}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Working Capital Locked (₹)</div>
            <div className="text-xl font-semibold text-neutral-900">
              {summary.workingCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-500">Interest Exposure (₹)</div>
            <div className="text-xl font-semibold text-neutral-900">
              {summary.interestExposure.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="min-w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b bg-neutral-50 text-neutral-600">
                <th className="px-3 py-2 text-left">VIN</th>
                <th className="px-3 py-2 text-left">Model / Variant</th>
                <th className="px-3 py-2 text-left">Branch</th>
                <th className="px-3 py-2 text-left">Ageing</th>
                <th className="px-3 py-2 text-left">Risk</th>
                <th className="px-3 py-2 text-right">MRP</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Reco Disc %</th>
                <th className="px-3 py-2 text-right">Reco Price</th>
                <th className="px-3 py-2 text-right">Margin %</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-neutral-500">
                    No vehicles found for the selected filters.
                  </td>
                </tr>
              )}
              {items.map((i) => (
                <tr
                  key={i.exposure_id}
                  className="border-b last:border-0 hover:bg-neutral-50/60 transition-colors"
                >
                  <td className="px-3 py-2 font-mono text-[11px] md:text-xs text-neutral-700">{i.vin}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{i.model}</div>
                    <div className="text-[11px] text-neutral-500">{i.variant_id}</div>
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{i.branch_id}</td>
                  <td className="px-3 py-2 text-neutral-700">{i.ageing_bucket}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        i.risk_tag === 'Critical'
                          ? 'bg-red-100 text-red-700'
                          : i.risk_tag === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : i.risk_tag === 'Medium'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {i.risk_tag}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {i.mrp_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {i.cost_price_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(i.recommended_discount_pct * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    {i.recommended_price_inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(i.margin_pct_after_discount * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(i)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(i.exposure_id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit WCX Exposure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Risk Tag</Label>
                <Input value={form.risk_tag} onChange={(e) => setForm((p) => ({ ...p, risk_tag: e.target.value }))} />
              </div>
              <div>
                <Label>Ageing Bucket</Label>
                <Input
                  value={form.ageing_bucket}
                  onChange={(e) => setForm((p) => ({ ...p, ageing_bucket: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Reco Discount % (decimal)</Label>
                <Input
                  value={form.recommended_discount_pct}
                  onChange={(e) => setForm((p) => ({ ...p, recommended_discount_pct: e.target.value }))}
                />
              </div>
              <div>
                <Label>Reco Price</Label>
                <Input
                  value={form.recommended_price_inr}
                  onChange={(e) => setForm((p) => ({ ...p, recommended_price_inr: e.target.value }))}
                />
              </div>
              <div>
                <Label>Margin % (decimal)</Label>
                <Input
                  value={form.margin_pct_after_discount}
                  onChange={(e) => setForm((p) => ({ ...p, margin_pct_after_discount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving} className="bg-neutral-900 text-white">
              {saving ? 'Saving...' : 'Update Exposure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

