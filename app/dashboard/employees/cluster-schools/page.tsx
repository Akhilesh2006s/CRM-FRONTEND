'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { usePermissions } from '@/components/permissions/PermissionsProvider'

type Zone = { _id: string; name: string }
type Cluster = { _id: string; name: string }
type School = {
  _id: string
  schoolName: string
  schoolCode?: string
  contactName?: string
  mobileNumber?: string
  location?: string
  zone?: string
  cluster?: string
}

export default function ClusterSchoolsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, permissionsReady, isSuperAdmin } = usePermissions()
  const [zones, setZones] = useState<Zone[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [zoneId, setZoneId] = useState(searchParams.get('zoneId') || '')
  const [clusterId, setClusterId] = useState(searchParams.get('clusterId') || '')
  const [schools, setSchools] = useState<School[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const role = String(user?.role || '')
  const allowed = isSuperAdmin || role === 'Super Admin'

  useEffect(() => {
    if (!permissionsReady) return
    if (!allowed) {
      toast.error('Super Admin only')
      router.push('/dashboard')
    }
  }, [permissionsReady, allowed, router])

  useEffect(() => {
    if (!allowed) return
    apiRequest<Zone[]>('/zones')
      .then((list) => setZones(Array.isArray(list) ? list : []))
      .catch(() => setZones([]))
  }, [allowed])

  useEffect(() => {
    if (!zoneId) {
      setClusters([])
      return
    }
    apiRequest<Cluster[]>(`/zones/${zoneId}/clusters`)
      .then((list) => setClusters(Array.isArray(list) ? list : []))
      .catch(() => setClusters([]))
  }, [zoneId])

  const zoneName = zones.find((zone) => zone._id === zoneId)?.name || ''
  const clusterName = clusters.find((cluster) => cluster._id === clusterId)?.name || ''

  useEffect(() => {
    if (!zoneName || !clusterName) {
      setSchools([])
      setLoaded(false)
      return
    }
    let cancelled = false
    setLoadingSchools(true)
    setLoaded(true)
    const params = new URLSearchParams({ zone: zoneName, cluster: clusterName })
    apiRequest<School[]>(`/schools?${params.toString()}`)
      .then((list) => {
        if (!cancelled) setSchools(Array.isArray(list) ? list : [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSchools([])
          toast.error(err instanceof Error ? err.message : 'Failed to load schools')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSchools(false)
      })
    return () => {
      cancelled = true
    }
  }, [zoneName, clusterName])

  const chooseZone = (nextZoneId: string) => {
    setZoneId(nextZoneId)
    setClusterId('')
    setSchools([])
    setLoaded(false)
    router.replace(`/dashboard/employees/cluster-schools?zoneId=${encodeURIComponent(nextZoneId)}`)
  }

  const chooseCluster = (nextClusterId: string) => {
    setClusterId(nextClusterId)
    const params = new URLSearchParams({ zoneId, clusterId: nextClusterId })
    router.replace(`/dashboard/employees/cluster-schools?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Cluster Schools</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Super Admin — select a cluster to see the schools under it.
        </p>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Zone</Label>
            <Select value={zoneId || undefined} onValueChange={chooseZone}>
              <SelectTrigger className="bg-white mt-1">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone._id} value={zone._id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cluster</Label>
            <Select value={clusterId || undefined} onValueChange={chooseCluster} disabled={!zoneId}>
              <SelectTrigger className="bg-white mt-1">
                <SelectValue placeholder="Select cluster" />
              </SelectTrigger>
              <SelectContent>
                {clusters.map((cluster) => (
                  <SelectItem key={cluster._id} value={cluster._id}>
                    {cluster.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border border-neutral-200">
        {!clusterId && <p className="p-4 text-sm text-neutral-600">Select a cluster to see its schools.</p>}
        {clusterId && loadingSchools && <p className="p-4 text-sm text-neutral-600">Loading schools...</p>}
        {clusterId && loaded && !loadingSchools && schools.length === 0 && (
          <p className="p-4 text-sm text-neutral-600">No schools under {clusterName}.</p>
        )}
        {clusterId && !loadingSchools && schools.length > 0 && (
          <div className="overflow-x-auto">
            <div className="px-4 py-3 border-b border-neutral-200 text-sm text-neutral-700">
              {schools.length} school{schools.length === 1 ? '' : 's'} in {clusterName}
              {zoneName ? ` · ${zoneName}` : ''}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-100 text-neutral-800">
                  <th className="py-2 px-3 text-left font-medium">School code</th>
                  <th className="py-2 px-3 text-left font-medium">School</th>
                  <th className="py-2 px-3 text-left font-medium">Contact</th>
                  <th className="py-2 px-3 text-left font-medium">Mobile</th>
                  <th className="py-2 px-3 text-left font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school._id} className="border-t border-neutral-100">
                    <td className="py-2 px-3">{school.schoolCode || '—'}</td>
                    <td className="py-2 px-3 font-medium text-neutral-900">{school.schoolName || '—'}</td>
                    <td className="py-2 px-3">{school.contactName || '—'}</td>
                    <td className="py-2 px-3">{school.mobileNumber || '—'}</td>
                    <td className="py-2 px-3">{school.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
