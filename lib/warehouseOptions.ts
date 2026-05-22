import { apiRequest } from '@/lib/api'

export const SCHOOL_TYPE_OPTIONS = ['New', 'Existing'] as const

export const DELIVERY_STATUS_OPTIONS = [
  'Pending',
  'In Transit',
  'Delivered',
  'Completed',
] as const

export type ZoneClusterMap = Record<string, string[]>

export async function loadZoneClusterOptions(): Promise<{
  zones: string[]
  clustersByZone: ZoneClusterMap
}> {
  const [pairsRaw, zonesRaw] = await Promise.all([
    apiRequest<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
    apiRequest<{ name?: string }[]>('/zones').catch(() => []),
  ])
  const pairs = Array.isArray(pairsRaw) ? pairsRaw : []
  const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : []
  const clustersByZone: ZoneClusterMap = {}
  pairs.forEach((zc) => {
    const zone = (zc.zone || '').trim()
    if (!zone) return
    if (!clustersByZone[zone]) clustersByZone[zone] = []
    const cl = (zc.cluster || '').trim()
    if (cl && !clustersByZone[zone].includes(cl)) clustersByZone[zone].push(cl)
  })
  const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean)
  const zones = [...new Set([...Object.keys(clustersByZone), ...zoneNamesFromApi])].sort((a, b) =>
    a.localeCompare(b)
  )
  return { zones, clustersByZone }
}
