'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Trash2, LocateFixed } from 'lucide-react'

type Office = {
  _id?: string
  name: string
  address: string
  latitude: string
  longitude: string
  radiusM: string
  isActive: boolean
}

const blank = (): Office => ({ name: '', address: '', latitude: '', longitude: '', radiusM: '200', isActive: true })

/**
 * Office locations. Checking in within an office's radius (200 m by default) is an office day;
 * anywhere else is a field day.
 */
/** School visits: check-in and visit updates are allowed only this close to the school (Super Admin). */
function SchoolVisitDistanceCard() {
  const [radius, setRadius] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiRequest<{ radiusM: number }>('/settings/school-visit')
      .then((d) => setRadius(String(d?.radiusM ?? 200)))
      .catch(() => setRadius('200'))
  }, [])

  const save = async () => {
    const r = Number(radius)
    if (!Number.isFinite(r) || r < 25 || r > 5000) return toast.error('Enter a distance between 25 and 5000 metres')
    setSaving(true)
    try {
      const d = await apiRequest<{ radiusM: number }>('/settings/school-visit', {
        method: 'PUT',
        body: JSON.stringify({ radiusM: Math.round(r) }),
      })
      setRadius(String(d?.radiusM ?? Math.round(r)))
      toast.success('School visit distance saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-4 md:p-5 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">School visit distance</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Employees can check in to a school and submit visit details only within this distance of the school&apos;s
          registered GPS point. Outside it they see &quot;You are outside the permitted school location.&quot; and a visit
          submitted from there is marked as an Invalid Visit. Only the Super Admin can change this.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="school-radius">Permitted distance (metres)</Label>
          <Input
            id="school-radius"
            type="number"
            min={25}
            max={5000}
            className="w-40"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </div>
        {[100, 200, 300, 500].map((v) => (
          <Button key={v} type="button" variant="outline" size="sm" onClick={() => setRadius(String(v))}>
            {v} m
          </Button>
        ))}
        <Button type="button" onClick={save} disabled={saving || radius === ''}>
          {saving ? 'Saving…' : 'Save distance'}
        </Button>
      </div>
    </Card>
  )
}

export default function OfficeLocationsSettingsPage() {
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState<number | null>(null)

  useEffect(() => {
    apiRequest<{ offices: Array<Omit<Office, 'latitude' | 'longitude' | 'radiusM'> & { latitude: number; longitude: number; radiusM?: number }> }>(
      '/settings/offices'
    )
      .then((data) =>
        setOffices(
          (data?.offices || []).map((o) => ({
            _id: o._id,
            name: o.name || '',
            address: o.address || '',
            latitude: String(o.latitude ?? ''),
            longitude: String(o.longitude ?? ''),
            radiusM: String(o.radiusM ?? 200),
            isActive: o.isActive !== false,
          }))
        )
      )
      .catch(() => toast.error('Could not load office locations'))
      .finally(() => setLoading(false))
  }, [])

  const update = (i: number, patch: Partial<Office>) =>
    setOffices((list) => list.map((o, idx) => (idx === i ? { ...o, ...patch } : o)))

  const useMyLocation = (i: number) => {
    if (!navigator.geolocation) return toast.error('Location is not available in this browser')
    setLocating(i)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update(i, { latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })
        setLocating(null)
      },
      () => {
        toast.error('Allow location access to use your current location')
        setLocating(null)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const save = async () => {
    for (const o of offices) {
      if (!o.name.trim()) return toast.error('Every office needs a name')
      if (!Number.isFinite(Number(o.latitude)) || !Number.isFinite(Number(o.longitude)) || o.latitude === '' || o.longitude === '') {
        return toast.error(`${o.name}: enter the latitude and longitude`)
      }
    }
    setSaving(true)
    try {
      const data = await apiRequest<{ offices: Array<{ _id: string }> }>('/settings/offices', {
        method: 'PUT',
        body: JSON.stringify({
          offices: offices.map((o) => ({
            ...(o._id ? { _id: o._id } : {}),
            name: o.name.trim(),
            address: o.address.trim(),
            latitude: Number(o.latitude),
            longitude: Number(o.longitude),
            radiusM: Number(o.radiusM) || 200,
            isActive: o.isActive,
          })),
        }),
      })
      setOffices((list) => list.map((o, i) => ({ ...o, _id: data?.offices?.[i]?._id || o._id })))
      toast.success('Office locations saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Office Locations</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Employees who check in within an office&apos;s radius (200 m by default) are on an office day and must check out
          there. Anywhere else is a field day. Stand in the office and use &quot;Use my location&quot; to fill the exact point.
        </p>
      </div>

      <SchoolVisitDistanceCard />

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <>
          {offices.length === 0 && (
            <Card className="p-5 text-sm text-neutral-600">
              No offices yet. Until one is added, every check-in counts as a field day.
            </Card>
          )}
          {offices.map((o, i) => (
            <Card key={o._id || `new-${i}`} className="p-5 space-y-3 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`name-${i}`}>Office name *</Label>
                  <Input id={`name-${i}`} className="mt-1 bg-white" value={o.name} onChange={(e) => update(i, { name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`radius-${i}`}>Radius (metres)</Label>
                  <Input
                    id={`radius-${i}`}
                    type="number"
                    min={50}
                    max={5000}
                    className="mt-1 bg-white"
                    value={o.radiusM}
                    onChange={(e) => update(i, { radiusM: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor={`address-${i}`}>Address</Label>
                  <Input id={`address-${i}`} className="mt-1 bg-white" value={o.address} onChange={(e) => update(i, { address: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`lat-${i}`}>Latitude *</Label>
                  <Input id={`lat-${i}`} inputMode="decimal" className="mt-1 bg-white" value={o.latitude} onChange={(e) => update(i, { latitude: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor={`lng-${i}`}>Longitude *</Label>
                  <Input id={`lng-${i}`} inputMode="decimal" className="mt-1 bg-white" value={o.longitude} onChange={(e) => update(i, { longitude: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => useMyLocation(i)} disabled={locating === i}>
                  <LocateFixed className="h-4 w-4 mr-1" />
                  {locating === i ? 'Locating…' : 'Use my location'}
                </Button>
                {o.latitude && o.longitude && (
                  <a
                    className="text-sm text-sky-700 underline"
                    href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check on map
                  </a>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.isActive} onChange={(e) => update(i, { isActive: e.target.checked })} />
                  Active
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 ml-auto"
                  onClick={() => setOffices((list) => list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            </Card>
          ))}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setOffices((list) => [...list, blank()])}>
              <Plus className="h-4 w-4 mr-1" />
              Add office
            </Button>
            <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
