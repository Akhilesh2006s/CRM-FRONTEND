'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Home = { latitude?: number; longitude?: number; address?: string; radiusM?: number; source?: string; setAt?: string }
type Employee = {
  _id: string
  name?: string
  empCode?: string
  role?: string
  zone?: string
  homeLocations?: { home1?: Home; home2?: Home }
}
type Key = 'home1' | 'home2'
const LABELS: Record<Key, string> = { home1: 'Home 1 (address at joining)', home2: 'Home 2 (work location)' }

/** Admin: the Home 1 / Home 2 geofences employees start their day from. */
export default function HomeLocationsPage() {
  const [rows, setRows] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ id: string; home: Key } | null>(null)
  const [form, setForm] = useState({ latitude: '', longitude: '', address: '', radiusM: '200' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Employee[]>('/field-day/home-locations')
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const q = search.trim().toLowerCase()
  const shown = useMemo(
    () => rows.filter((r) => !q || [r.name, r.empCode, r.zone, r.role].some((v) => String(v || '').toLowerCase().includes(q))),
    [rows, q]
  )

  const edit = (row: Employee, home: Key) => {
    const h = row.homeLocations?.[home] || {}
    setEditing({ id: row._id, home })
    setForm({
      latitude: h.latitude != null ? String(h.latitude) : '',
      longitude: h.longitude != null ? String(h.longitude) : '',
      address: h.address || '',
      radiusM: String(h.radiusM || 200),
    })
  }

  const save = async (clear = false) => {
    if (!editing) return
    if (!clear && (!form.latitude.trim() || !form.longitude.trim())) return toast.error('Enter the latitude and longitude')
    setSaving(true)
    try {
      await apiRequest(`/field-day/home-locations/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(
          clear
            ? { home: editing.home, latitude: null }
            : { home: editing.home, latitude: form.latitude, longitude: form.longitude, address: form.address, radiusM: form.radiusM }
        ),
      })
      toast.success(clear ? 'Cleared. It is saved again from the next Start Day.' : 'Saved')
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const cell = (row: Employee, home: Key) => {
    const h = row.homeLocations?.[home]
    const open = editing?.id === row._id && editing.home === home
    return (
      <td className="py-2 px-3 align-top">
        {h?.latitude != null ? (
          <div>
            <div>{h.address || `${h.latitude.toFixed(5)}, ${h.longitude?.toFixed(5)}`}</div>
            <div className="text-xs text-neutral-500">
              {h.radiusM || 200} m · {h.source === 'admin' ? 'set by Admin' : 'from first Start Day'} ·{' '}
              <a className="text-sky-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`}>
                Map
              </a>
            </div>
          </div>
        ) : (
          <span className="text-neutral-500">Not saved (taken at first Start Day)</span>
        )}
        {!open ? (
          <button className="mt-1 text-xs text-sky-700 underline" onClick={() => edit(row, home)}>
            {h?.latitude != null ? 'Change' : 'Set'}
          </button>
        ) : null}
      </td>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-neutral-900">Home Locations</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Employees start a field day from Home 1, Home 2 (within the radius) or Others with the hotel / address. A home not set here
            is saved from the employee&apos;s first Start Day there.
          </p>
        </div>
        <Input className="w-64 bg-white" placeholder="Search name / code / zone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {editing ? (
        <Card className="p-4 space-y-3">
          <div className="font-semibold">
            {rows.find((r) => r._id === editing.id)?.name}: {LABELS[editing.home]}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input className="bg-white" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <Input className="bg-white" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            <Input className="bg-white" placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input className="bg-white" placeholder="Radius (m)" value={form.radiusM} onChange={(e) => setForm({ ...form, radiusM: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save(false)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => save(true)} disabled={saving}>
              Clear
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="py-2 px-3">Employee</th>
              <th className="py-2 px-3">{LABELS.home1}</th>
              <th className="py-2 px-3">{LABELS.home2}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-neutral-500">Loading…</td>
              </tr>
            ) : shown.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-6 text-center text-neutral-500">No employees found.</td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 px-3 align-top">
                    <div className="font-medium">{r.name || '—'}</div>
                    <div className="text-xs text-neutral-500">{[r.empCode, r.role, r.zone].filter(Boolean).join(' · ')}</div>
                  </td>
                  {cell(r, 'home1')}
                  {cell(r, 'home2')}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
