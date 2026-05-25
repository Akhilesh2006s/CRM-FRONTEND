'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import {
  filterTagOptions,
  getTaggingSectionLabel,
  supportsEmployeeTagging,
} from '@/lib/employeeTagging'

type EmployeeOption = { _id: string; name: string; role: string }

export default function NewEmployeePage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
    phone: '',
    mobile: '',
    address1: '',
    state: '',
    zone: '',
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    taggedEmployeeIds: [] as string[],
  })
  const [tagOptions, setTagOptions] = useState<EmployeeOption[]>([])
  const filteredTagOptions = useMemo(
    () => filterTagOptions(tagOptions, form.role),
    [tagOptions, form.role]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})

  const loadZones = async () => {
    try {
      // Zone–cluster pairs (optional). The Clusters / Zones admin pages only hit
      // /clusters and /zones, so this collection is often empty unless someone
      // POSTs to /zones-clusters — without a merge, the employee form shows no clusters.
      const [pairsRaw, zonesRaw] = await Promise.all([
        apiRequest<{ zone?: string; cluster?: string }[]>('/zones-clusters').catch(() => []),
        apiRequest<{ name?: string }[]>('/zones').catch(() => []),
      ])
      const pairs = Array.isArray(pairsRaw) ? pairsRaw : []
      const zoneDocs = Array.isArray(zonesRaw) ? zonesRaw : []

      const zoneMap: Record<string, string[]> = {}
      pairs.forEach((zc) => {
        const zone = (zc.zone || '').trim()
        if (!zone) return
        if (!zoneMap[zone]) zoneMap[zone] = []
        const cl = (zc.cluster || '').trim()
        if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl)
      })

      const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean)

      const allZones = [...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort((a, b) =>
        a.localeCompare(b)
      )

      setZones(allZones)
      setClustersByZone(zoneMap)
    } catch (e) {
      console.error('Failed to load zones & clusters', e)
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((f) => ({ ...f, pincode }))

    // Only lookup when full 6-digit pincode entered
    if (pincode.length === 6) {
      setLoadingPincode(true)
      try {
        const response = await apiRequest<{
          city?: string
          town?: string
          district?: string
          state?: string
          zone?: string
          cluster?: string
          success: boolean
        }>(`/location/resolve?pincode=${pincode}`)

        if (response.success) {
          setForm((f) => ({
            ...f,
            state: response.state || f.state,
            district: response.district || f.district,
            city: response.city || response.town || f.city,
            zone: response.zone || f.zone,
            cluster: response.cluster || (response.zone ? '' : f.cluster),
          }))
        }
      } catch (err) {
        // On failure, keep pincode but allow manual override later if needed
        console.error('Pincode lookup failed:', err)
      } finally {
        setLoadingPincode(false)
      }
    } else {
      // If user clears or edits pincode to less than 6 digits, clear derived fields
      setForm((f) => ({
        ...f,
        state: '',
        district: '',
        city: '',
        zone: '',
        cluster: '',
      }))
    }
  }

  useEffect(() => {
    loadZones()
    apiRequest<EmployeeOption[]>('/employees?isActive=true')
      .then((data) => setTagOptions(Array.isArray(data) ? data : []))
      .catch(() => setTagOptions([]))
  }, [])

  const toggleTagged = (empId: string) => {
    setForm((f) => ({
      ...f,
      taggedEmployeeIds: f.taggedEmployeeIds.includes(empId)
        ? f.taggedEmployeeIds.filter((x) => x !== empId)
        : [...f.taggedEmployeeIds, empId],
    }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      // Validate cluster for Executive role
      if (form.role === 'Executive' && !form.cluster?.trim()) {
        setError('Cluster is required for Executive role')
        setSubmitting(false)
        return
      }
      
      const payload: any = {
        ...form,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || form.lastName || 'Executive',
      }
      // Only include cluster if role is Executive
      if (form.role !== 'Executive') {
        delete payload.cluster
      }
      if (!supportsEmployeeTagging(form.role)) {
        delete payload.taggedEmployeeIds
      }
      await apiRequest('/employees/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      router.push('/dashboard/employees/active')
    } catch (err: any) {
      setError(err?.message || 'Failed to create employee')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add New Employee</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-lg font-semibold mb-2">Personal Data</div>
          
          <div>
            <Label>First Name *</Label>
            <Input className="bg-white text-neutral-900" name="firstName" value={form.firstName} onChange={onChange} placeholder="First Name" required />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input className="bg-white text-neutral-900" name="lastName" value={form.lastName} onChange={onChange} placeholder="Last Name" />
          </div>
          <div>
            <Label>Emp ID / Code</Label>
            <Input className="bg-white text-neutral-900" name="empCode" value={form.empCode} onChange={onChange} placeholder="Employee ID / Code" />
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} placeholder="Email" required />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input className="bg-white text-neutral-900" name="phone" value={form.phone} onChange={onChange} placeholder="Secondary phone" />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input className="bg-white text-neutral-900" name="mobile" value={form.mobile} onChange={onChange} placeholder="Mobile" required />
          </div>
          <div className="md:col-span-2">
            <Label>Address 1</Label>
            <Textarea className="bg-white text-neutral-900" name="address1" value={form.address1} onChange={onChange} placeholder="Address 1" />
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">Location & User Type</div>

          <div>
            <Label>PinCode *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="pincode"
              value={form.pincode}
              onChange={handlePincodeChange}
              placeholder="Pincode"
              required
            />
          </div>
          <div>
            <Label>Zone *</Label>
            <Select
              value={form.zone}
              onValueChange={(zone) =>
                setForm((f) => ({
                  ...f,
                  zone,
                  // Reset cluster when zone changes
                  cluster: '',
                }))
              }
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.role === 'Executive' && (
            <div>
              <Label>Cluster *</Label>
              <Select
                value={form.cluster}
                onValueChange={(cluster) =>
                  setForm((f) => ({
                    ...f,
                    cluster,
                  }))
                }
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select Employee Cluster" />
                </SelectTrigger>
                <SelectContent>
                  {(clustersByZone[form.zone] || []).length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-neutral-500">
                      No clusters linked to this zone. Add links under Users → Zones.
                    </div>
                  ) : (
                    (clustersByZone[form.zone] || []).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>District</Label>
            <Input
              className="bg-neutral-100 text-neutral-900"
              name="district"
              value={form.district}
              readOnly
              placeholder="Auto-filled from Pincode"
            />
          </div>
          <div>
            <Label>City</Label>
            <Input
              className="bg-neutral-100 text-neutral-900"
              name="city"
              value={form.city}
              readOnly
              placeholder="Auto-filled from Pincode"
            />
          </div>
          <div>
            <Label>State *</Label>
            <Input
              className="bg-neutral-100 text-neutral-900"
              name="state"
              value={form.state}
              readOnly
              placeholder="Auto-filled from Pincode"
              required
            />
          </div>
          <div>
            <Label>User Type *</Label>
            <Select
              value={form.role}
              onValueChange={(v) =>
                setForm((f) => {
                  const allowed = new Set(filterTagOptions(tagOptions, v).map((e) => e._id))
                  return {
                    ...f,
                    role: v,
                    cluster: v === 'Executive' ? f.cluster : '',
                    taggedEmployeeIds: supportsEmployeeTagging(v)
                      ? f.taggedEmployeeIds.filter((id) => allowed.has(id))
                      : [],
                  }
                })
              }
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Executive">Executive</SelectItem>
                <SelectItem value="Trainer">Trainer</SelectItem>
                <SelectItem value="Finance Manager">Finance Manager</SelectItem>
                <SelectItem value="Coordinator">Coordinator</SelectItem>
                <SelectItem value="Senior Coordinator">Senior Coordinator</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Executive Manager">Executive Manager</SelectItem>
                <SelectItem value="Warehouse Executive">Warehouse Executive</SelectItem>
                <SelectItem value="Warehouse Manager">Warehouse Manager</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Password *</Label>
            <Input className="bg-white text-neutral-900" type="password" name="password" value={form.password} onChange={onChange} required />
          </div>

          {supportsEmployeeTagging(form.role) && (
            <div className="md:col-span-2">
              <Label className="mb-2 block">{getTaggingSectionLabel(form.role)}</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {form.role === 'Executive Manager' || form.role === 'Manager'
                  ? 'Select executives assigned to this role.'
                  : 'Select employees to tag under this role.'}
              </p>
              <div className="max-h-48 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {filteredTagOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    {form.role === 'Executive Manager' || form.role === 'Manager'
                      ? 'No active executives available to tag'
                      : 'No employees available to tag'}
                  </p>
                ) : (
                  filteredTagOptions.map((e) => (
                    <label key={e._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.taggedEmployeeIds.includes(e._id)}
                        onChange={() => toggleTagged(e._id)}
                      />
                      {e.name} ({e.role})
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
