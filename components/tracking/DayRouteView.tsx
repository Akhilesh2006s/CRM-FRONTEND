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
          <Input type="date" allowPastDates value={date} max={todayIst()} onChange={(e) => setDate(e.target.value)} className="rounded-xl w-44" />
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
              : 'Blue line: the route travelled (GPS noise removed). S = Start Day, numbers = schools, E = End Day. The same km is used in Expenses and Field Day.'}
          </p>

          {/* Route line: Start Day → each school → End Day, with the time and km between stops. */}
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Route line</h3>
            {route.stops.length === 0 ? <p className="text-slate-500">No travel recorded for this day.</p> : null}
            <ol className="relative">
              {route.stops.map((stop, i) => {
                const leg = route.legs[i]
                const last = i === route.stops.length - 1
                const dot = stop.kind === 'start' ? 'bg-green-600' : stop.kind === 'end' || stop.kind === 'last' ? 'bg-red-600' : 'bg-violet-600'
                return (
                  <li key={i} className="relative pl-8">
                    {!last ? <span className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-blue-500" aria-hidden /> : null}
                    <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full ${dot} text-white text-xs font-bold flex items-center justify-center`}>
                      {stop.kind === 'start' ? 'S' : stop.kind === 'end' || stop.kind === 'last' ? 'E' : i}
                    </span>
                    <p className="font-semibold text-slate-800">
                      {stop.name} <span className="font-normal text-slate-500">· {time(stop.at)}{stop.endAt && stop.endAt !== stop.at ? ` – ${time(stop.endAt)}` : ''}</span>
                    </p>
                    {leg && !last ? (
                      <div className={`flex flex-wrap items-center gap-2 py-3 text-slate-600 ${focus === i ? 'bg-blue-50 rounded-lg px-2' : ''}`}>
                        <span>
                          ↓ {duration(leg.minutes)} · {legKmText(leg)}
                        </span>
                        <button type="button" className="text-blue-700 hover:underline" onClick={() => setFocus(focus === i ? undefined : i)}>
                          {focus === i ? 'Show whole day' : 'Show on map'}
                        </button>
                        {legDirectionsUrl(leg) ? (
                          <a href={legDirectionsUrl(leg)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
                            <Navigation className="h-3.5 w-3.5" /> Google Maps
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <div className="pb-1" />
                    )}
                  </li>
                )
              })}
            </ol>
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
