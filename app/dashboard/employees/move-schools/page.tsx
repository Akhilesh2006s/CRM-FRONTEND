'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { useRouter } from 'next/navigation'

type Zone = { _id: string; name: string }
type Cluster = { _id: string; name: string }
type School = {
  _id: string
  schoolName: string
  schoolCode?: string
  zone?: string
  cluster?: string
}

export default function MoveSchoolsPage() {
  const router = useRouter()
  const { user, permissionsReady, isSuperAdmin } = usePermissions()
  const [zones, setZones] = useState<Zone[]>([])
  const [sourceClusters, setSourceClusters] = useState<Cluster[]>([])
  const [targetClusters, setTargetClusters] = useState<Cluster[]>([])
  const [schoolCode, setSchoolCode] = useState('')
  const [sourceZoneId, setSourceZoneId] = useState('')
  const [sourceClusterId, setSourceClusterId] = useState('')
  const [targetZoneId, setTargetZoneId] = useState('')
  const [targetClusterId, setTargetClusterId] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!permissionsReady) return
    const role = String(user?.role || '')
    if (!isSuperAdmin && role !== 'Admin' && role !== 'Super Admin') {
      toast.error('Admin only')
      router.push('/dashboard')
      return
    }
    apiRequest<Zone[]>('/zones')
      .then((z) => setZones(Array.isArray(z) ? z : []))
      .catch(() => setZones([]))
  }, [permissionsReady, user, isSuperAdmin, router])

  useEffect(() => {
    if (!sourceZoneId) {
      setSourceClusters([])
      return
    }
    apiRequest<Cluster[]>(`/zones/${sourceZoneId}/clusters`)
      .then((c) => setSourceClusters(Array.isArray(c) ? c : []))
      .catch(() => setSourceClusters([]))
  }, [sourceZoneId])

  useEffect(() => {
    if (!targetZoneId) {
      setTargetClusters([])
      return
    }
    apiRequest<Cluster[]>(`/zones/${targetZoneId}/clusters`)
      .then((c) => setTargetClusters(Array.isArray(c) ? c : []))
      .catch(() => setTargetClusters([]))
  }, [targetZoneId])

  const sourceZoneName = zones.find((z) => z._id === sourceZoneId)?.name || ''
  const sourceClusterName = sourceClusters.find((c) => c._id === sourceClusterId)?.name || ''
  const samePlace =
    Boolean(sourceZoneId && sourceClusterId && targetZoneId && targetClusterId) &&
    sourceZoneId === targetZoneId &&
    sourceClusterId === targetClusterId
  const canMove = Boolean(
    sourceZoneId && sourceClusterId && targetZoneId && targetClusterId && selectedIds.length > 0 && !samePlace
  )

  const clearSearch = () => {
    setSchools([])
    setSelectedIds([])
    setSearched(false)
  }

  const searchBySchoolCode = async () => {
    const code = schoolCode.trim()
    if (!sourceZoneId || !sourceClusterId) {
      toast.error('Select the source zone and source cluster first')
      return
    }
    if (!code) {
      toast.error('Enter a school code')
      return
    }
    setSearching(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({
        schoolCode: code,
        zone: sourceZoneName,
        cluster: sourceClusterName,
      })
      const data = await apiRequest<School[]>(`/schools?${params.toString()}`)
      const list = Array.isArray(data) ? data : []
      setSchools(list)
      setSelectedIds(list.map((school) => school._id))
      if (list.length === 0) toast.error('No school found for that school code in the source cluster')
    } catch (e: any) {
      setSchools([])
      setSelectedIds([])
      toast.error(e?.message || 'Failed to search schools')
    } finally {
      setSearching(false)
    }
  }

  const onMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceZoneId || !sourceClusterId) {
      toast.error('Select the source zone and source cluster')
      return
    }
    if (!targetZoneId || !targetClusterId) {
      toast.error('Select the target zone and target cluster')
      return
    }
    if (samePlace) {
      toast.error('Source and target must be different')
      return
    }
    if (selectedIds.length === 0) {
      toast.error('Search and select a school by school code')
      return
    }
    setSaving(true)
    try {
      const result = await apiRequest<{
        message: string
        leadsUpdated: number
        ordersUpdated: number
        removedFromClusters?: string[]
        targetCluster: string
        targetZone: string
      }>('/schools/move', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'selection',
          schoolIds: selectedIds,
          targetZoneId,
          targetClusterId,
        }),
      })
      const from =
        result.removedFromClusters && result.removedFromClusters.length > 0
          ? ` Removed from: ${result.removedFromClusters.join(', ')}.`
          : ''
      toast.success(
        `Moved to ${result.targetCluster} (${result.targetZone}).${from} Leads: ${result.leadsUpdated}, DCs: ${result.ordersUpdated}`
      )
      setSelectedIds([])
      setSchools([])
      setSchoolCode('')
      setSearched(false)
    } catch (err: any) {
      toast.error(err?.message || 'Move failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleSchool = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Move Schools</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Admin only — choose the source on the left and the target on the right, then search by school code to move.
        </p>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <form onSubmit={onMove} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 rounded border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-neutral-900">Source</h2>
              <div>
                <Label>Source zone *</Label>
                <Select
                  value={sourceZoneId}
                  onValueChange={(v) => {
                    setSourceZoneId(v)
                    setSourceClusterId('')
                    clearSearch()
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z._id} value={z._id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source cluster *</Label>
                <Select
                  value={sourceClusterId}
                  onValueChange={(v) => {
                    setSourceClusterId(v)
                    clearSearch()
                  }}
                  disabled={!sourceZoneId}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceClusters.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && sourceZoneId && sourceClusterId && (
                <Link
                  href={`/dashboard/employees/cluster-schools?zoneId=${encodeURIComponent(sourceZoneId)}&clusterId=${encodeURIComponent(sourceClusterId)}`}
                  className="inline-block text-sm font-medium text-blue-700 hover:underline"
                >
                  View schools in this cluster
                </Link>
              )}
            </div>

            <div className="space-y-4 rounded border border-neutral-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-neutral-900">Target</h2>
              <div>
                <Label>Target zone *</Label>
                <Select
                  value={targetZoneId}
                  onValueChange={(v) => {
                    setTargetZoneId(v)
                    setTargetClusterId('')
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z._id} value={z._id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target cluster *</Label>
                <Select value={targetClusterId} onValueChange={setTargetClusterId} disabled={!targetZoneId}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select cluster" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetClusters.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="move-school-code">School code *</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="move-school-code"
                className="bg-white"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                placeholder="Enter school code"
              />
              <Button
                type="button"
                variant="outline"
                disabled={searching || !sourceZoneId || !sourceClusterId}
                onClick={() => void searchBySchoolCode()}
              >
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>

          {searched && (
            <div className="border rounded bg-white max-h-64 overflow-y-auto text-sm">
              {schools.length === 0 ? (
                <p className="p-3 text-neutral-500">No school found for that school code in the source cluster.</p>
              ) : (
                <ul>
                  {schools.map((s) => (
                    <li key={s._id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={() => toggleSchool(s._id)}
                      />
                      <span>
                        {s.schoolCode || '—'}
                        {s.schoolName ? ` · ${s.schoolName}` : ''}
                        {s.zone ? ` · ${s.zone}` : ''}
                        {s.cluster ? ` · ${s.cluster}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button type="submit" disabled={saving || !canMove}>
            {saving ? 'Moving…' : 'Move schools'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
