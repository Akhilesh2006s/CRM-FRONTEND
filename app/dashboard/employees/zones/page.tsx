'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { isDuplicateName, normalizeName } from '@/lib/normalizeName'
import { toast } from 'sonner'

type Zone = { _id?: string; name: string }
type Cluster = { _id?: string; name: string }
type ZoneCluster = { _id?: string; zone: string; cluster: string; zoneId?: string; clusterId?: string }
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

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [pairs, setPairs] = useState<ZoneCluster[]>([])
  const [mappings, setMappings] = useState<PincodeMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [savingZone, setSavingZone] = useState(false)
  const [savingPair, setSavingPair] = useState(false)
  const [savingPincode, setSavingPincode] = useState(false)
  const [zoneName, setZoneName] = useState('')
  const [pairZoneId, setPairZoneId] = useState('')
  const [pairClusterId, setPairClusterId] = useState('')
  const [pincodeForm, setPincodeForm] = useState({
    pincode: '',
    zoneId: '',
    clusterId: '',
    city: '',
    district: '',
    state: '',
  })
  const [loadingPincode, setLoadingPincode] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [zonesRaw, clustersRaw, pairsRaw, mappingsRaw] = await Promise.all([
        apiRequest<Zone[]>('/zones'),
        apiRequest<Cluster[]>('/clusters'),
        apiRequest<ZoneCluster[]>('/zones-clusters'),
        apiRequest<PincodeMapping[]>('/zones/pincode-mappings'),
      ])
      setZones(Array.isArray(zonesRaw) ? zonesRaw : [])
      setClusters(Array.isArray(clustersRaw) ? clustersRaw : [])
      setPairs(Array.isArray(pairsRaw) ? pairsRaw : [])
      setMappings(Array.isArray(mappingsRaw) ? mappingsRaw : [])
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load zones data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

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
    setSavingZone(true)
    try {
      await apiRequest('/zones', { method: 'POST', body: JSON.stringify({ name: trimmed }) })
      setZoneName('')
      toast.success('Zone added')
      loadAll()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save zone')
    } finally {
      setSavingZone(false)
    }
  }

  const onDeleteZone = async (id?: string) => {
    if (!id) return
    if (!confirm('Delete this zone?')) return
    try {
      await apiRequest(`/zones/${id}`, { method: 'DELETE' })
      toast.success('Zone deleted')
      loadAll()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete zone')
    }
  }

  const onAddPair = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pairZoneId || !pairClusterId) {
      toast.error('Select zone and cluster')
      return
    }
    setSavingPair(true)
    try {
      await apiRequest('/zones-clusters', {
        method: 'POST',
        body: JSON.stringify({ zoneId: pairZoneId, clusterId: pairClusterId }),
      })
      setPairZoneId('')
      setPairClusterId('')
      toast.success('Zone–cluster link added')
      loadAll()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to link zone and cluster')
    } finally {
      setSavingPair(false)
    }
  }

  const onDeletePair = async (id?: string) => {
    if (!id) return
    if (!confirm('Remove this zone–cluster link?')) return
    try {
      await apiRequest(`/zones-clusters/${id}`, { method: 'DELETE' })
      loadAll()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove link')
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
        success?: boolean
      }>(`/location/resolve?pincode=${digits}`)

      const zoneMatch = zones.find((z) => z.name === res.zone)
      const clusterMatch = clusters.find((c) => c.name === res.cluster)

      setPincodeForm((f) => ({
        ...f,
        city: res.city || res.town || f.city,
        district: res.district || f.district,
        state: res.state || f.state,
        zoneId: zoneMatch?._id || f.zoneId,
        clusterId: clusterMatch?._id || f.clusterId,
      }))
    } catch {
      // allow manual entry
    } finally {
      setLoadingPincode(false)
    }
  }

  const clustersForPincodeZone = clusters.filter((c) => {
    if (!pincodeForm.zoneId) return true
    const zone = zones.find((z) => z._id === pincodeForm.zoneId)
    if (!zone) return true
    return pairs.some((p) => p.zone === zone.name && p.cluster === c.name)
  })

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
      loadAll()
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
      loadAll()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete mapping')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Zones</h1>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Add Zone</h2>
        <form onSubmit={onAddZone} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
          <Button type="submit" disabled={savingZone}>
            {savingZone ? 'Saving…' : 'Add Zone'}
          </Button>
          <Button type="button" variant="outline" onClick={loadAll} disabled={loading}>
            Refresh
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
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z._id || z.name} className="border-b last:border-0">
                  <td className="py-2 px-3">{z.name}</td>
                  <td className="py-2 px-3 text-right">
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

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Zone → Cluster links</h2>
        <p className="text-sm text-neutral-600">
          Link clusters to zones so Add Employee shows the correct cluster list per zone.
        </p>
        <form onSubmit={onAddPair} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label>Zone</Label>
            <Select value={pairZoneId} onValueChange={setPairZoneId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z._id} value={z._id!}>{z.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cluster</Label>
            <Select value={pairClusterId} onValueChange={setPairClusterId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select cluster" /></SelectTrigger>
              <SelectContent>
                {clusters.map((c) => (
                  <SelectItem key={c._id} value={c._id!}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={savingPair || clusters.length === 0}>
            {savingPair ? 'Linking…' : 'Link cluster to zone'}
          </Button>
        </form>
        {pairs.length > 0 && (
          <table className="w-full text-sm bg-white border border-neutral-200 rounded">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Zone</th>
                <th className="py-2 px-3 text-left">Cluster</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={p._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{p.zone}</td>
                  <td className="py-2 px-3">{p.cluster}</td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDeletePair(p._id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

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
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select zone" /></SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z._id} value={z._id!}>{z.name}</SelectItem>
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
              <SelectTrigger className="bg-white"><SelectValue placeholder="Select cluster" /></SelectTrigger>
              <SelectContent>
                {clustersForPincodeZone.map((c) => (
                  <SelectItem key={c._id} value={c._id!}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input className="bg-white" value={pincodeForm.city} onChange={(e) => setPincodeForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>District</Label>
            <Input className="bg-white" value={pincodeForm.district} onChange={(e) => setPincodeForm((f) => ({ ...f, district: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input className="bg-white" value={pincodeForm.state} onChange={(e) => setPincodeForm((f) => ({ ...f, state: e.target.value }))} />
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
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => onDeleteMapping(m._id)}>
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
