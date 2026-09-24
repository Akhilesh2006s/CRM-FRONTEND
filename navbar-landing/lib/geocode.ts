/**
 * Geocode a school address via OpenStreetMap Nominatim (no API key).
 * Returns { latitude, longitude } or null.
 */
export async function geocodeSchoolLocation(parts: {
  location?: string
  area?: string
  city?: string
  district?: string
  state?: string
  pincode?: string
}): Promise<{ latitude: string; longitude: string } | null> {
  const q = [
    parts.location,
    parts.area,
    parts.city || parts.district,
    parts.state,
    parts.pincode,
    'India',
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(', ')

  if (q.replace(/,/g, '').trim().length < 5) return null

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const lat = data[0]?.lat
    const lon = data[0]?.lon
    if (lat == null || lon == null) return null
    return { latitude: String(lat), longitude: String(lon) }
  } catch {
    return null
  }
}
