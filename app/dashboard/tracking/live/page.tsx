'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Row = {
  employeeId: string
  name?: string
  empCode?: string
  role?: string
  zone?: string
  lastUsed: string
  lastLocation: { latitude: number; longitude: number }
  batteryLevel: number | null
  charging: boolean | null
  gpsStatus: 'on' | 'off'
  dayStarted: boolean
  dayStartedAt?: string | null
  mode?: string | null
  startLocationType?: string
  startLocationDetails?: string
}

const START_LABELS: Record<string, string> = { home1: 'Home 1', home2: 'Home 2', other: 'Others' }
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet'

const ago = (v: string) => {
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ${mins % 60} min ago`
  return new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const time = (v?: string | null) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '')

/** Loads Leaflet once from the CDN (no npm dependency). */
function loadLeaflet(): Promise<any> {
  const w = window as any
  if (w.L) return Promise.resolve(w.L)
  if (w.__leafletLoading) return w.__leafletLoading
  w.__leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${LEAFLET}.css`
    document.head.appendChild(css)
    const js = document.createElement('script')
    js.src = `${LEAFLET}.js`
    js.onload = () => resolve(w.L)
    js.onerror = () => reject(new Error('Could not load the map'))
    document.body.appendChild(js)
  })
  return w.__leafletLoading
}

/** Admin only: every employee's last GPS position; click a pin for location, battery and GPS status. */
export default function LiveLocationsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyStarted, setOnlyStarted] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [address, setAddress] = useState('')
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const layer = useRef<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Row[]>('/tracking/latest')
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const q = search.trim().toLowerCase()
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!onlyStarted || r.dayStarted) &&
          (!q || [r.name, r.empCode, r.zone, r.role].some((v) => String(v || '').toLowerCase().includes(q)))
      ),
    [rows, q, onlyStarted]
  )

  useEffect(() => {
    let alive = true
    loadLeaflet()
      .then((L) => {
        if (!alive || !mapEl.current) return
        if (!map.current) {
          map.current = L.map(mapEl.current).setView([17.385, 78.4867], 6)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map.current)
          layer.current = L.layerGroup().addTo(map.current)
        }
        layer.current.clearLayers()
        const points: [number, number][] = []
        shown.forEach((r) => {
          const { latitude, longitude } = r.lastLocation || ({} as Row['lastLocation'])
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
          points.push([latitude, longitude])
          const color = r.gpsStatus === 'on' ? '#16a34a' : '#dc2626'
          L.circleMarker([latitude, longitude], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 })
            .bindTooltip(r.name || 'Employee')
            .on('click', () => setSelected(r))
            .addTo(layer.current)
        })
        if (points.length) map.current.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
      })
      .catch((e) => toast.error(e.message))
    return () => {
      alive = false
    }
  }, [shown])

  useEffect(() => {
    setAddress('')
    if (!selected) return
    const { latitude, longitude } = selected.lastLocation
    let alive = true
    apiRequest<{ pincode?: string; town?: string }>(`/location/pincode-from-coords?lat=${latitude}&lng=${longitude}`)
      .then((res) => alive && setAddress([res?.town, res?.pincode].filter(Boolean).join(' - ')))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [selected])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold text-neutral-900">Live Locations</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Click a pin for the employee&apos;s current location, battery and GPS status. Green = GPS on, red = GPS off or no location for 15
            minutes.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyStarted} onChange={(e) => setOnlyStarted(e.target.checked)} />
          Day started only
        </label>
        <Input className="w-64 bg-white" placeholder="Search name / code / zone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden p-0">
          <div ref={mapEl} className="h-[520px] w-full" />
        </Card>
        <Card className="p-4 space-y-3 text-sm">
          {selected ? (
            <>
              <div>
                <div className="text-lg font-semibold">{selected.name || 'Employee'}</div>
                <div className="text-neutral-500">{[selected.empCode, selected.role, selected.zone].filter(Boolean).join(' · ')}</div>
              </div>
              <Info label="Current location">
                {address || 'Finding the address…'}
                <div className="text-xs text-neutral-500">
                  {selected.lastLocation.latitude.toFixed(5)}, {selected.lastLocation.longitude.toFixed(5)} · {ago(selected.lastUsed)}
                </div>
                <a
                  className="text-sky-700 underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${selected.lastLocation.latitude},${selected.lastLocation.longitude}`}
                >
                  Open in Maps
                </a>
              </Info>
              <Info label="Battery">
                {selected.batteryLevel == null ? 'Not reported yet' : `${selected.batteryLevel}%${selected.charging ? ' (charging)' : ''}`}
              </Info>
              <Info label="GPS status">
                <span className={selected.gpsStatus === 'on' ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
                  {selected.gpsStatus === 'on' ? 'On' : 'Off'}
                </span>
              </Info>
              <Info label="Day">
                {selected.dayStarted
                  ? `Started ${time(selected.dayStartedAt)} · ${selected.mode === 'office' ? 'Office' : 'Field'}${
                      START_LABELS[selected.startLocationType || '']
                        ? ` · from ${START_LABELS[selected.startLocationType || '']}${selected.startLocationDetails ? `: ${selected.startLocationDetails}` : ''}`
                        : ''
                    }`
                  : 'Not started / ended'}
              </Info>
            </>
          ) : (
            <p className="text-neutral-500">Click a pin on the map, or an employee below.</p>
          )}
          <div className="max-h-64 overflow-y-auto border-t pt-2">
            {shown.length === 0 ? (
              <p className="text-neutral-500">{loading ? 'Loading…' : 'No employees with a location.'}</p>
            ) : (
              shown.map((r) => (
                <button
                  key={r.employeeId}
                  onClick={() => {
                    setSelected(r)
                    map.current?.setView([r.lastLocation.latitude, r.lastLocation.longitude], 15)
                  }}
                  className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-neutral-50 ${
                    selected?.employeeId === r.employeeId ? 'bg-sky-50' : ''
                  }`}
                >
                  <span>{r.name || 'Employee'}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${r.gpsStatus === 'on' ? 'bg-green-600' : 'bg-red-600'}`} />
                </button>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-neutral-500">{label}</div>
      <div className="text-neutral-900">{children}</div>
    </div>
  )
}
