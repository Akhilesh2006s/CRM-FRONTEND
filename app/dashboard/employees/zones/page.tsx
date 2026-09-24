'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { isDuplicateName, normalizeName } from '@/lib/normalizeName'
import { toast } from 'sonner'

type Manager = { _id: string; name: string; email?: string; role?: string }
type Zone = {
  _id?: string
  name: string
  managerId?: Manager | string | null
}
type Cluster = { _id?: string; name: string; zoneId?: string | Zone | null }
type PincodeMapping = {
  _id?: string
  pincode: string
  city?: string
  district?: string
  state?: string
  zone: string
  cluster: string
  zoneId?: string
  clusterId?: string
}

function managerLabel(manager?: Manager | string | null) {
  if (!manager) return '—'
  if (typeof manager === 'string') return manager
  return manager.name || '—'
}

function managerIdOf(zone: Zone) {
  if (!zone.managerId) return ''
  return typeof zone.managerId === 'string' ? zone.managerId : zone.managerId._id
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [zoneClusters, setZoneClusters] = useState<Cluster[]>([])
  const [mappings, setMappings] = useState<PincodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [savingZone, setSavingZone] = useState(false)
  const [savingCluster, setSavingCluster] = useState(false)
  const [savingPincode, setSavingPincode] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [zoneManagerId, setZoneManagerId] = useState('')
  const [clusterName, setClusterName] = useState('')
  const [pincodeForm, setPincodeForm] = useState({
    pincode: '',
    zoneId: '',
    clusterId: '',
    city: '',
    district: '',
    state: '',
  })
  const [loadingPincode, setLoadingPincode] = useState(false)

  const selectedZone = useMemo(
    () => zones.find((z) => z._id === selectedZoneId) || null,
    [zones, selectedZoneId]
  )

  const loadZonesAndManagers = async () => {
    setLoading(true)
    try {
      const [zonesRaw, managersRaw, mappingsRaw] = await Promise.all([
        apiRequest<Zone[]>('/zones'),
        apiRequest<Manager[]>('/executive-managers').catch(() => []),
        apiRequest<PincodeMapping[]>('/zones/pincode-mappings').catch(() => []),
      ])
      const zoneList = Array.isArray(zonesRaw) ? zonesRaw : []
      setZones(zoneList)
      setManagers(Array.isArray(managersRaw) ? managersRaw : [])
      setMappings(Array.isArray(mappingsRaw) ? mappingsRaw : [])
      if (!selectedZoneId && zoneList[0]?._id) {
        setSelectedZoneId(zoneList[0]._id)
      } else if (selectedZoneId && !zoneList.some((z) => z._id === selectedZoneId)) {
        setSelectedZoneId(zoneList[0]?._id || '')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load zones data')
    } finally {
      setLoading(false)
    }
  }

  const loadClustersForZone = async (zoneId: string) => {
    if (!zoneId) {
      setZoneClusters([])
      return
    }
    setLoadingClusters(true)
    try {
      const data = await apiRequest<Cluster[]>(`/zones/${zoneId}/clusters`)
      setZoneClusters(Array.isArray(data) ? data : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load clusters')
      setZoneClusters([])
    } finally {
      setLoadingClusters(false)
    }
  }

  useEffect(() => {
    loadZonesAndManagers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedZoneId) {
      loadClustersForZone(selectedZoneId)
    } else {
      setZoneClusters([])
    }
  }, [selectedZoneId])

  const onAddZone = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = normalizeName(zoneName)
    if (!trimmed) {
      toast.error('Zone is required')
      return
    }
    if (isDuplicateName(trimmed, zones)) {
      toast.error('Zone already exists')
      return
    }
    if (!zoneManagerId) {
      toast.error('Select a zone manager')
      return
    }
    setSavingZone(true)
    try {
      const created = await apiRequest<Zone>('/zones', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, managerId: zoneManagerId }),
      })
      setZoneName('')
      setZoneManagerId('')
      toast.success('Zone added')
      await loadZonesAndManagers()
      if (created?._id) setSelectedZoneId(created._id)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save zone')
    } finally {
      setSavingZone(false)
    }
  }

  const onUpdateZoneManager = async (zoneId: string, managerId: string) => {
    try {
      await apiRequest('/zones', {
        method: 'POST',
        body: JSON.stringify({ id: zoneId, name: zones.find((z) => z._id === zoneId)?.name, managerId }),
      })
      toast.success('Zone manager updated')
      loadZonesAndManagers()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update manager')
    }
  }

  const onDeleteZone = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this zone? Clusters under it will be unassigned.')) return
    try {
      await apiRequest(`/zones/${id}`, { method: 'DELETE' })
      toast.success('Zone deleted')
      if (selectedZoneId === id) setSelectedZoneId('')
      loadZonesAndManagers()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete zone')
    }
  }

  const onAddCluster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedZoneId) {
      toast.error('Select a zone first')
      return
    }
    const trimmed = normalizeName(clusterName)
    if (!trimmed) {
      toast.error('Cluster is required')
      return
    }
    if (isDuplicateName(trimmed, zoneClusters)) {
      toast.error('Cluster already exists in this zone')
      return
    }
    setSavingCluster(true)
    try {
      await apiRequest('/clusters', {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, zoneId: selectedZoneId }),
      })
      setClusterName('')
      toast.success('Cluster added to zone')
      loadClustersForZone(selectedZoneId)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save cluster')
    } finally {
      setSavingCluster(false)
    }
  }

  const onDeleteCluster = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this cluster?')) return
    try {
      await apiRequest(`/clusters/${id}`, { method: 'DELETE' })
      toast.success('Cluster deleted')
      if (selectedZoneId) loadClustersForZone(selectedZoneId)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete cluster')
    }
  }

  const handlePincodeLookup = async (pincode: string) => {
    const digits = pincode.replace(/\D/g, '').slice(0, 6)
    setPincodeForm((f) => ({ ...f, pincode: digits }))
    if (digits.length !== 6) return

    setLoadingPincode(true)
    try {
      const res = await apiRequest<{
        city?: string
        town?: string
        district?: string
        state?: string
        zone?: string
        cluster?: string
      }>(`/location/resolve?pincode=${digits}`)

      const zoneMatch = zones.find((z) => z.name === res.zone)
      let clusterMatch: Cluster | undefined
      if (zoneMatch?._id) {
        const clusters = await apiRequest<Cluster[]>(`/zones/${zoneMatch._id}/clusters`).catch(() => [])
        clusterMatch = (Array.isArray(clusters) ? clusters : []).find((c) => c.name === res.cluster)
      }

      setPincodeForm((f) => ({
        ...f,
        city: res.city || res.town || f.city,
        district: res.district || f.district,
        state: res.state || f.state,
        zoneId: zoneMatch?._id || f.zoneId,
        clusterId: clusterMatch?._id || '',
      }))
    } catch {
      // allow manual entry
    } finally {
      setLoadingPincode(false)
    }
  }

  const [pincodeClusters, setPincodeClusters] = useState<Cluster[]>([])
  useEffect(() => {
    const load = async () => {
      if (!pincodeForm.zoneId) {
        setPincodeClusters([])
        return
      }
      if (pincodeForm.zoneId === selectedZoneId) {
        setPincodeClusters(zoneClusters)
        return
      }
      try {
        const data = await apiRequest<Cluster[]>(`/zones/${pincodeForm.zoneId}/clusters`)
        setPincodeClusters(Array.isArray(data) ? data : [])
      } catch {
        setPincodeClusters([])
      }
    }
    load()
  }, [pincodeForm.zoneId, selectedZoneId, zoneClusters])

  const onAddPincodeMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    const pincode = pincodeForm.pincode.replace(/\D/g, '').slice(0, 6)
    if (pincode.length !== 6) {
      toast.error('Enter a valid 6-digit pincode')
      return
    }
    if (!pincodeForm.zoneId || !pincodeForm.clusterId) {
      toast.error('Select zone and cluster for this pincode')
      return
    }
    const dup = mappings.some((m) => m.pincode === pincode)
    if (dup) {
      toast.error('Pincode mapping already exists')
      return
    }
    setSavingPincode(true)
    try {
      await apiRequest('/zones/pincode-mappings', {
        method: 'POST',
        body: JSON.stringify({
          pincode,
          zoneId: pincodeForm.zoneId,
          clusterId: pincodeForm.clusterId,
          city: pincodeForm.city,
          district: pincodeForm.district,
          state: pincodeForm.state,
        }),
      })
      setPincodeForm({ pincode: '', zoneId: '', clusterId: '', city: '', district: '', state: '' })
      toast.success('Pincode mapping saved')
      const mappingsRaw = await apiRequest<PincodeMapping[]>('/zones/pincode-mappings')
      setMappings(Array.isArray(mappingsRaw) ? mappingsRaw : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save pincode mapping')
    } finally {
      setSavingPincode(false)
    }
  }

  const onDeleteMapping = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this pincode mapping?')) return
    try {
      await apiRequest(`/zones/pincode-mappings/${id}`, { method: 'DELETE' })
      setMappings((prev) => prev.filter((m) => m._id !== id))
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete mapping')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Zones & Clusters</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Step 1: create a zone and assign its manager. Step 2: select the zone and add clusters under it.
        </p>
      </div>

      {/* Step 1 — Zones */}
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Step 1 — Zones</h2>
        <form onSubmit={onAddZone} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label>Zone name *</Label>
            <Input
              className="bg-white text-neutral-900"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Enter zone"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Zone manager *</Label>
            <Select value={zoneManagerId} onValueChange={setZoneManagerId}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select from managers list" />
              </SelectTrigger>
              <SelectContent>
                {managers.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No managers found — create via Assign Managers
                  </SelectItem>
                ) : (
                  managers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                      {m.email ? ` (${m.email})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={savingZone || managers.length === 0}>
            {savingZone ? 'Saving…' : 'Add Zone'}
          </Button>
        </form>

        {loading ? (
          <div className="text-sm text-neutral-600">Loading…</div>
        ) : zones.length === 0 ? (
          <div className="text-sm text-neutral-600">No zones yet.</div>
        ) : (
          <table className="w-full text-sm bg-white border border-neutral-200 rounded">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Zone</th>
                <th className="py-2 px-3 text-left">Manager</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr
                  key={z._id || z.name}
                  className={`border-b last:border-0 cursor-pointer ${
                    selectedZoneId === z._id ? 'bg-blue-50' : 'hover:bg-neutral-50'
                  }`}
                  onClick={() => z._id && setSelectedZoneId(z._id)}
                >
                  <td className="py-2 px-3 font-medium">{z.name}</td>
                  <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={managerIdOf(z) || undefined}
                      onValueChange={(v) => z._id && onUpdateZoneManager(z._id, v)}
                    >
                      <SelectTrigger className="bg-white h-8 max-w-[220px]">
                        <SelectValue placeholder="Assign manager" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((m) => (
                          <SelectItem key={m._id} value={m._id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {z._id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => onDeleteZone(z._id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Step 2 — Clusters under selected zone */}
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Step 2 — Clusters</h2>
        <p className="text-sm text-neutral-600">
          {selectedZone
            ? `Selected zone: ${selectedZone.name} (manager: ${managerLabel(selectedZone.managerId)})`
            : 'Select a zone above to view and add its clusters.'}
        </p>

        <form onSubmit={onAddCluster} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label>Cluster name *</Label>
            <Input
              className="bg-white text-neutral-900"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              placeholder="Enter cluster"
              required
              disabled={!selectedZoneId}
            />
          </div>
          <Button type="submit" disabled={savingCluster || !selectedZoneId}>
            {savingCluster ? 'Saving…' : 'Add Cluster to Zone'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedZoneId || loadingClusters}
            onClick={() => selectedZoneId && loadClustersForZone(selectedZoneId)}
          >
            Refresh clusters
          </Button>
        </form>

        {!selectedZoneId ? (
          <div className="text-sm text-neutral-600">No zone selected.</div>
        ) : loadingClusters ? (
          <div className="text-sm text-neutral-600">Loading clusters…</div>
        ) : zoneClusters.length === 0 ? (
          <div className="text-sm text-neutral-600">No clusters under this zone yet.</div>
        ) : (
          <table className="w-full text-sm bg-white border border-neutral-200 rounded">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Cluster</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {zoneClusters.map((c) => (
                <tr key={c._id || c.name} className="border-b last:border-0">
                  <td className="py-2 px-3">{c.name}</td>
                  <td className="py-2 px-3 text-right">
                    {c._id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => onDeleteCluster(c._id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pincode mappings */}
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Pincode mappings</h2>
        <p className="text-sm text-neutral-600">
          Map pincode to city, district, state, zone, and cluster for automatic fill on Add Employee.
        </p>
        <form onSubmit={onAddPincodeMapping} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Pincode *</Label>
            <Input
              className="bg-white"
              value={pincodeForm.pincode}
              onChange={(e) => handlePincodeLookup(e.target.value)}
              placeholder="6-digit pincode"
              maxLength={6}
            />
            {loadingPincode && <p className="text-xs text-neutral-500">Looking up address…</p>}
          </div>
          <div className="space-y-2">
            <Label>Zone *</Label>
            <Select
              value={pincodeForm.zoneId}
              onValueChange={(v) => setPincodeForm((f) => ({ ...f, zoneId: v, clusterId: '' }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z._id} value={z._id!}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cluster *</Label>
            <Select
              value={pincodeForm.clusterId}
              onValueChange={(v) => setPincodeForm((f) => ({ ...f, clusterId: v }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select cluster" />
              </SelectTrigger>
              <SelectContent>
                {pincodeClusters.map((c) => (
                  <SelectItem key={c._id} value={c._id!}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              className="bg-white"
              value={pincodeForm.city}
              onChange={(e) => setPincodeForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <Input
              className="bg-white"
              value={pincodeForm.district}
              onChange={(e) => setPincodeForm((f) => ({ ...f, district: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input
              className="bg-white"
              value={pincodeForm.state}
              onChange={(e) => setPincodeForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={savingPincode}>
              {savingPincode ? 'Saving…' : 'Save pincode mapping'}
            </Button>
          </div>
        </form>

        {mappings.length > 0 && (
          <table className="w-full text-sm bg-white border border-neutral-200 rounded">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Pincode</th>
                <th className="py-2 px-3 text-left">City</th>
                <th className="py-2 px-3 text-left">District</th>
                <th className="py-2 px-3 text-left">State</th>
                <th className="py-2 px-3 text-left">Zone</th>
                <th className="py-2 px-3 text-left">Cluster</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m._id} className="border-b last:border-0">
                  <td className="py-2 px-3 font-medium">{m.pincode}</td>
                  <td className="py-2 px-3">{m.city || '-'}</td>
                  <td className="py-2 px-3">{m.district || '-'}</td>
                  <td className="py-2 px-3">{m.state || '-'}</td>
                  <td className="py-2 px-3">{m.zone}</td>
                  <td className="py-2 px-3">{m.cluster}</td>
                  <td className="py-2 px-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => onDeleteMapping(m._id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
