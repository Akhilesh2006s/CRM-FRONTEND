'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { routeMapHtml, legDirectionsUrl, legKmText, dayKmText, type DayRoute } from '@/lib/routeMapHtml'
import { Battery, MapPin, Navigation, Route as RouteIcon, Satellite } from 'lucide-react'

const time = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—'
const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)

/** Daily Travel Report for one employee: route on the map, legs, total km, battery and GPS. */
export function DayRouteView({ employeeId, initialDate }: { employeeId: string; initialDate?: string }) {
  const [date, setDate] = useState(initialDate || todayIst())
  const [route, setRoute] = useState<DayRoute | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focus, setFocus] = useState<number | undefined>(undefined)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setFocus(undefined)
    try {
      setRoute(await apiRequest<DayRoute>(`/tracking/${employeeId}/day-route?date=${date}`))
    } catch (e: unknown) {
      setRoute(null)
      setError(e instanceof Error ? e.message : 'Could not load the route')
    } finally {
      setLoading(false)
    }
  }, [employeeId, date])

  useEffect(() => {
    void load()
  }, [load])

  // Google Maps road view when the server has a Google key; else our map of the GPS points.
  const googleUrl = route ? (focus != null ? route.legs[focus]?.embedUrl : route.embedUrl) || null : null
  const html = useMemo(() => (route && !googleUrl ? routeMapHtml(route, focus) : ''), [route, focus, googleUrl])

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
          <Input type="date" value={date} max={todayIst()} onChange={(e) => setDate(e.target.value)} className="rounded-xl w-44" />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="rounded-xl">
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error ? <p className="text-red-600">{error}</p> : null}

      {route ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Stat icon={<RouteIcon className="h-4 w-4" />} label={route.roadKm ? 'Road distance (Google)' : 'Total travelled'} value={dayKmText(route)} />
            <Stat icon={<MapPin className="h-4 w-4" />} label="Start Day" value={time(route.signInAt)} />
            <Stat icon={<MapPin className="h-4 w-4" />} label="End Day" value={route.signOutAt ? time(route.signOutAt) : 'Running'} />
            <Stat
              icon={<Battery className="h-4 w-4" />}
              label="Battery"
              value={route.batteryLevel != null ? `${route.batteryLevel}%` : '—'}
            />
            <Stat
              icon={<Satellite className="h-4 w-4" />}
              label="GPS"
              value={route.gpsStatus === 'on' ? 'On' : route.gpsStatus === 'off' ? 'Off' : '—'}
              tone={route.gpsStatus === 'off' ? 'text-red-600' : route.gpsStatus === 'on' ? 'text-green-700' : undefined}
            />
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 420 }}>
            {googleUrl ? (
              <iframe title="Route map" src={googleUrl} className="w-full h-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            ) : (
              <iframe title="Route map" srcDoc={html} className="w-full h-full border-0" />
            )}
          </div>
          <p className="text-xs text-slate-500">
            {route.roadKm
              ? 'Km is the shortest road distance in Google Maps from the start point to each school (by bike and by car). The same km is used in Expenses and Field Day.'
              : `Blue line: the GPS route recorded by the phone (${route.pointCount} points). S = Start Day, numbers = schools, E = End Day. The same km is used in Expenses and Field Day.`}
          </p>

          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {route.legs.length === 0 ? <p className="p-3 text-slate-500">No travel recorded for this day.</p> : null}
            {route.legs.map((leg, i) => (
              <div key={i} className={`p-3 flex flex-wrap items-center gap-3 ${focus === i ? 'bg-blue-50' : ''}`}>
                <div className="flex-1 min-w-[220px]">
                  <p className="font-semibold text-slate-800">
                    {leg.from} → {leg.to}
                  </p>
                  <p className="text-slate-600">
                    {time(leg.startAt)} – {time(leg.endAt)} · reached in {duration(leg.minutes)} · {legKmText(leg)}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setFocus(focus === i ? undefined : i)}>
                  {focus === i ? 'Show whole day' : 'Show on map'}
                </Button>
                {legDirectionsUrl(leg) ? (
                  <a
                    href={legDirectionsUrl(leg)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Open in Google Maps
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-2">
      <p className="text-xs text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className={`font-semibold ${tone || 'text-slate-800'}`}>{value}</p>
    </div>
  )
}
