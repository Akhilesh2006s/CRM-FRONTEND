/**
 * A self-contained map page (Leaflet + OpenStreetMap) of one employee's day route:
 * the GPS line in blue like Google Maps, Start / End markers and numbered school stops.
 * Used in an <iframe srcDoc> on the web; the app has a copy for its WebView (src/lib/routeMapHtml.ts).
 */
export type RoutePoint = { latitude: number; longitude: number; recordedAt?: string; batteryLevel?: number | null }
export type RouteStop = { kind: string; name: string; at?: string; endAt?: string; minutes?: number | null; latitude?: number; longitude?: number }
export type RouteLeg = {
  from: string
  to: string
  startAt?: string
  endAt?: string
  minutes: number
  km: number
  start?: { latitude: number; longitude: number } | null
  end?: { latitude: number; longitude: number } | null
}
export type DayRoute = {
  day: string
  employee?: { name?: string }
  km: number
  pointCount: number
  signInAt?: string | null
  signOutAt?: string | null
  batteryLevel?: number | null
  gpsStatus?: 'on' | 'off' | null
  points: RoutePoint[]
  stops: RouteStop[]
  legs: RouteLeg[]
}

const time = (v?: string) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : ''

/** Google Maps directions for one leg (Google draws the road route, like its own app). */
export function legDirectionsUrl(leg: RouteLeg) {
  if (!leg.start || !leg.end) return ''
  return `https://www.google.com/maps/dir/?api=1&origin=${leg.start.latitude},${leg.start.longitude}&destination=${leg.end.latitude},${leg.end.longitude}&travelmode=driving`
}

export function routeMapHtml(route: DayRoute, focusLeg?: number) {
  const valid = (p?: { latitude?: number; longitude?: number } | null) =>
    !!p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))
  const line = route.points.filter(valid).map((p) => [p.latitude, p.longitude])
  const stops = route.stops.filter(valid).map((s, i) => ({
    lat: s.latitude,
    lng: s.longitude,
    kind: s.kind,
    label: s.kind === 'start' ? 'S' : s.kind === 'end' || s.kind === 'last' ? 'E' : String(i),
    text: `${s.name}<br>${time(s.at)}${s.endAt && s.endAt !== s.at ? ` – ${time(s.endAt)}` : ''}`,
  }))
  const leg = focusLeg != null ? route.legs[focusLeg] : undefined
  const focus = leg && leg.start && leg.end ? [[leg.start.latitude, leg.start.longitude], [leg.end.latitude, leg.end.longitude]] : null
  const data = JSON.stringify({ line, stops, focus }).replace(/</g, '\\u003c')
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0}.pin{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;color:#fff;font:700 12px sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}.msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:14px sans-serif;color:#64748b}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var d=${data};
var map=L.map('m',{zoomControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var all=[];
if(d.line.length>1){L.polyline(d.line,{color:'#1A73E8',weight:6,opacity:0.9}).addTo(map);all=all.concat(d.line);}
d.stops.forEach(function(s){
  var c=s.kind==='start'?'#16A34A':(s.kind==='end'||s.kind==='last')?'#DC2626':'#7C3AED';
  L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:'<div class="pin" style="background:'+c+'">'+s.label+'</div>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map).bindPopup(s.text);
  all.push([s.lat,s.lng]);
});
if(d.focus){map.fitBounds(d.focus,{padding:[40,40]});}
else if(all.length){map.fitBounds(all,{padding:[30,30]});}
else{map.setView([17.385,78.4867],11);document.body.insertAdjacentHTML('beforeend','<div class="msg">No GPS points for this day</div>');}
</script></body></html>`
}
