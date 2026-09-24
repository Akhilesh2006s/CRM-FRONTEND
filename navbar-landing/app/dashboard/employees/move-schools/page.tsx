'use client'

import { useEffect, useState } from 'react'
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
  pincode?: string
}

export default function MoveSchoolsPage() {
  const router = useRouter()
  const { user, permissionsReady, isSuperAdmin } = usePermissions()
  const [zones, setZones] = useState<Zone[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [mode, setMode] = useState<'pincode' | 'selection'>('pincode')
  const [pincode, setPincode] = useState('')
  const [targetZoneId, setTargetZoneId] = useState('')
  const [targetClusterId, setTargetClusterId] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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
    if (!targetZoneId) {
      setClusters([])
      return
    }
    apiRequest<Cluster[]>(`/zones/${targetZoneId}/clusters`)
      .then((c) => setClusters(Array.isArray(c) ? c : []))
      .catch(() => setClusters([]))
  }, [targetZoneId])

  const loadSchoolsForSelection = async () => {
    try {
      const data = await apiRequest<School[]>('/schools')
      setSchools(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load schools')
    }
  }

  useEffect(() => {
    if (mode === 'selection') loadSchoolsForSelection()
  }, [mode])

  const onMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetZoneId || !targetClusterId) {
      toast.error('Select target zone and cluster')
      return
    }
    if (mode === 'selection' && selectedIds.length === 0) {
      toast.error('Select at least one school')
      return
    }
    if (mode === 'pincode' && pincode.replace(/\D/g, '').length !== 6) {
      toast.error('Enter a valid 6-digit pincode')
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
          mode,
          pincode: mode === 'pincode' ? pincode : undefined,
          schoolIds: mode === 'selection' ? selectedIds : undefined,
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
      setPincode('')
      if (mode === 'selection') {
        await loadSchoolsForSelection()
      }
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
          Admin only — move schools by PINCODE or by selecting schools from one cluster/zone to another.
        </p>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <form onSubmit={onMove} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'pincode' | 'selection')}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pincode">By PINCODE</SelectItem>
                  <SelectItem value="selection">By selecting schools</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'pincode' && (
              <div>
                <Label>Pincode *</Label>
                <Input
                  className="bg-white"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  placeholder="6-digit pincode"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Select value={targetClusterId} onValueChange={setTargetClusterId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === 'selection' && (
            <div className="border rounded bg-white max-h-64 overflow-y-auto text-sm">
              {schools.length === 0 ? (
                <p className="p-3 text-neutral-500">No schools loaded.</p>
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
                        {s.schoolName}
                        {s.pincode ? ` · ${s.pincode}` : ''}
                        {s.cluster ? ` · ${s.cluster}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Moving…' : 'Move schools'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
