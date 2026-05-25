'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { isDuplicateName, normalizeName } from '@/lib/normalizeName'

type Zone = { _id?: string; name: string }
type Cluster = { _id?: string; name: string }

export default function ZonesClustersPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [loadingClusters, setLoadingClusters] = useState(true)
  const [savingZone, setSavingZone] = useState(false)
  const [savingCluster, setSavingCluster] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [clusterName, setClusterName] = useState('')

  const loadZones = async () => {
    setLoadingZones(true)
    try {
      const data = await apiRequest<Zone[]>('/zones')
      setZones(Array.isArray(data) ? data : [])
    } catch (e: any) {
      alert(e?.message || 'Failed to load zones')
    } finally {
      setLoadingZones(false)
    }
  }

  const loadClusters = async () => {
    setLoadingClusters(true)
    try {
      const data = await apiRequest<Cluster[]>('/clusters')
      setClusters(Array.isArray(data) ? data : [])
    } catch (e: any) {
      alert(e?.message || 'Failed to load clusters')
    } finally {
      setLoadingClusters(false)
    }
  }

  useEffect(() => {
    loadZones()
    loadClusters()
  }, [])

  const onAddZone = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = normalizeName(zoneName)
    if (!name) {
      alert('Zone is required')
      return
    }
    if (isDuplicateName(name, zones)) {
      alert('Zone already exists')
      return
    }
    setSavingZone(true)
    try {
      await apiRequest('/zones', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setZoneName('')
      loadZones()
    } catch (e: any) {
      alert(e?.message || 'Failed to save zone')
    } finally {
      setSavingZone(false)
    }
  }

  const onAddCluster = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = normalizeName(clusterName)
    if (!name) {
      alert('Cluster is required')
      return
    }
    if (isDuplicateName(name, clusters)) {
      alert('Cluster already exists')
      return
    }
    setSavingCluster(true)
    try {
      await apiRequest('/clusters', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      setClusterName('')
      loadClusters()
    } catch (e: any) {
      alert(e?.message || 'Failed to save cluster')
    } finally {
      setSavingCluster(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Zones & Clusters</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-6">
        {/* Zones section */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Zones</h2>
          <form onSubmit={onAddZone} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label>Zone *</Label>
              <Input
                className="bg-white text-neutral-900"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Enter Zone"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingZone}>
                {savingZone ? 'Saving…' : 'Add Zone'}
              </Button>
              <Button type="button" variant="outline" onClick={loadZones} disabled={loadingZones}>
                Refresh
              </Button>
            </div>
          </form>

          <Card className="p-0 overflow-x-auto bg-white border border-neutral-200">
            {loadingZones ? (
              <div className="p-4 text-sm text-neutral-600">Loading zones…</div>
            ) : zones.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">No zones added yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Zone</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z._id || z.name} className="border-b last:border-0">
                      <td className="py-2 px-3">{z.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Clusters section */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Clusters</h2>
          <form onSubmit={onAddCluster} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label>Cluster *</Label>
              <Input
                className="bg-white text-neutral-900"
                value={clusterName}
                onChange={(e) => setClusterName(e.target.value)}
                placeholder="Enter Cluster"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={savingCluster}>
                {savingCluster ? 'Saving…' : 'Add Cluster'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={loadClusters}
                disabled={loadingClusters}
              >
                Refresh
              </Button>
            </div>
          </form>

          <Card className="p-0 overflow-x-auto bg-white border border-neutral-200">
            {loadingClusters ? (
              <div className="p-4 text-sm text-neutral-600">Loading clusters…</div>
            ) : clusters.length === 0 ? (
              <div className="p-4 text-sm text-neutral-600">No clusters added yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 border-b text-neutral-700">
                    <th className="py-2 px-3 text-left">Cluster</th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((c) => (
                    <tr key={c._id || c.name} className="border-b last:border-0">
                      <td className="py-2 px-3">{c.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </Card>
    </div>
  )
}

