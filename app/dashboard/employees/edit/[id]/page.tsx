'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { displayRoleName } from '@/lib/roleLabels'
import {
  filterTagOptions,
  getTaggingSectionLabel,
  isSingleZoneRole,
  supportsEmployeeTagging,
} from '@/lib/employeeTagging'
import { toast } from 'sonner'
import { sanitizePhoneInput, validateStrictIndianMobile } from '@/lib/phone'
import {
  validateEmployeeFirstName,
  validateEmployeeLastName,
  validateEmployeeCode,
  validateEmployeeIdentityFields,
  type EmployeeIdentityErrors,
} from '@/lib/employeeFormValidation'

type EmployeeOption = { _id: string; name: string; role: string }

export default function EditEmployeePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    phone: '',
    mobile: '',
    address1: '',
    state: '',
    zone: '',
    zones: [] as string[],
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    taggedEmployeeIds: [] as string[],
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [identityErrors, setIdentityErrors] = useState<EmployeeIdentityErrors>({})
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})
  const [tagOptions, setTagOptions] = useState<EmployeeOption[]>([])

  const loadZones = async () => {
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
    setZones([...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort())
    setClustersByZone(zoneMap)
  }

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        await loadZones()
        const [emp, employees] = await Promise.all([
          apiRequest<any>(`/employees/${id}`),
          apiRequest<EmployeeOption[]>('/employees?isActive=true').catch(() => []),
        ])
        const parts = (emp.name || '').trim().split(/\s+/)
        const firstName = emp.firstName || parts[0] || ''
        const lastName = emp.lastName || parts.slice(1).join(' ') || ''
        setForm({
          firstName,
          lastName,
          empCode: emp.empCode || '',
          email: emp.email || '',
          phone: emp.phone && emp.phone !== '0' ? emp.phone : '',
          mobile: emp.mobile || emp.phone || '',
          address1: emp.address1 || '',
          state: emp.state || '',
          zone: emp.zone || (Array.isArray(emp.zones) ? emp.zones[0] : '') || '',
          zones: Array.isArray(emp.zones) && emp.zones.length
            ? emp.zones
            : emp.zone
              ? [emp.zone]
              : [],
          cluster: emp.cluster || '',
          district: emp.district || '',
          city: emp.city || '',
          pincode: emp.pincode || '',
          role: emp.role || 'Executive',
          taggedEmployeeIds: (emp.taggedEmployeeIds || []).map((x: any) => String(x._id || x)),
        })
        setTagOptions(Array.isArray(employees) ? employees.filter((e) => e._id !== id) : [])
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load employee')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const clearIdentityError = (field: keyof EmployeeIdentityErrors) => {
    setIdentityErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    const nextValue = name === 'phone' || name === 'mobile' ? sanitizePhoneInput(value, 15) : value
    setForm((f) => ({ ...f, [name]: nextValue }))
    if (name === 'firstName') {
      if (!value.trim()) {
        clearIdentityError('firstName')
      } else {
        const check = validateEmployeeFirstName(value)
        setIdentityErrors((prev) => ({
          ...prev,
          firstName: check.ok ? undefined : check.message,
        }))
      }
    } else if (name === 'lastName') {
      const check = validateEmployeeLastName(value)
      setIdentityErrors((prev) => ({
        ...prev,
        lastName: check.ok ? undefined : check.message,
      }))
    } else if (name === 'empCode') {
      if (!value.trim()) {
        clearIdentityError('empCode')
      } else {
        const check = validateEmployeeCode(value)
        setIdentityErrors((prev) => ({
          ...prev,
          empCode: check.ok ? undefined : check.message,
        }))
      }
    }
  }

  const onIdentityBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'firstName') {
      const check = validateEmployeeFirstName(value)
      setIdentityErrors((prev) => ({
        ...prev,
        firstName: check.ok ? undefined : check.message,
      }))
    } else if (name === 'lastName') {
      const check = validateEmployeeLastName(value)
      setIdentityErrors((prev) => ({
        ...prev,
        lastName: check.ok ? undefined : check.message,
      }))
    } else if (name === 'empCode') {
      const check = validateEmployeeCode(value)
      setIdentityErrors((prev) => ({
        ...prev,
        empCode: check.ok ? undefined : check.message,
      }))
    }
  }

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
      const identityCheck = validateEmployeeIdentityFields({
        firstName: form.firstName,
        lastName: form.lastName,
        empCode: form.empCode,
      })
      if (!identityCheck.ok) {
        setIdentityErrors(identityCheck.errors)
        const firstMsg =
          identityCheck.errors.firstName ||
          identityCheck.errors.lastName ||
          identityCheck.errors.empCode ||
          'Please fix the highlighted fields.'
        setError(firstMsg)
        setSubmitting(false)
        return
      }
      setIdentityErrors({})

      const mobileCheck = validateStrictIndianMobile(form.mobile)
      if (!mobileCheck.ok) {
        setError(mobileCheck.message)
        setSubmitting(false)
        return
      }
      if (form.phone.trim()) {
        const phoneCheck = validateStrictIndianMobile(form.phone)
        if (!phoneCheck.ok) {
          setError(phoneCheck.message)
          setSubmitting(false)
          return
        }
      }

      const selectedZones = isSingleZoneRole(form.role)
        ? form.zone.trim()
          ? [form.zone.trim()]
          : []
        : form.zones.map((z) => z.trim()).filter(Boolean)
      if (selectedZones.length === 0) {
        setError(isSingleZoneRole(form.role) ? 'Zone is required for BDE' : 'Select at least one zone')
        setSubmitting(false)
        return
      }
      if (isSingleZoneRole(form.role) && !form.cluster?.trim()) {
        setError('Cluster is required for BDE role')
        setSubmitting(false)
        return
      }
      const payload: Record<string, unknown> = {
        ...form,
        firstName: identityCheck.values.firstName,
        lastName: identityCheck.values.lastName,
        empCode: identityCheck.values.empCode,
        name: `${identityCheck.values.firstName} ${identityCheck.values.lastName}`.trim(),
        phone: form.phone || form.mobile,
        mobile: form.mobile,
        zone: selectedZones[0],
        zones: selectedZones,
        taggedEmployeeIds: supportsEmployeeTagging(form.role)
          ? form.taggedEmployeeIds.filter((id) =>
              filterTagOptions(tagOptions, form.role).some((e) => e._id === id)
            )
          : [],
      }
      if (form.role !== 'Executive') delete payload.cluster
      await apiRequest(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      toast.success('Employee updated')
      router.push('/dashboard/employees/active')
    } catch (err: any) {
      setError(err?.message || 'Failed to update employee')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Employee</h1>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-lg font-semibold mb-2">Personal Data</div>
          <div>
            <Label>First Name *</Label>
            <Input
              className={`bg-white text-neutral-900 ${identityErrors.firstName ? 'border-red-500' : ''}`}
              name="firstName"
              value={form.firstName}
              onChange={onChange}
              onBlur={onIdentityBlur}
              required
            />
            {identityErrors.firstName && (
              <p className="text-xs text-red-600 mt-1">{identityErrors.firstName}</p>
            )}
          </div>
          <div>
            <Label>Last Name</Label>
            <Input
              className={`bg-white text-neutral-900 ${identityErrors.lastName ? 'border-red-500' : ''}`}
              name="lastName"
              value={form.lastName}
              onChange={onChange}
              onBlur={onIdentityBlur}
            />
            {identityErrors.lastName && (
              <p className="text-xs text-red-600 mt-1">{identityErrors.lastName}</p>
            )}
          </div>
          <div>
            <Label>Emp ID / Code</Label>
            <Input
              className={`bg-white text-neutral-900 ${identityErrors.empCode ? 'border-red-500' : ''}`}
              name="empCode"
              value={form.empCode}
              onChange={onChange}
              onBlur={onIdentityBlur}
              required
            />
            {identityErrors.empCode && (
              <p className="text-xs text-red-600 mt-1">{identityErrors.empCode}</p>
            )}
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} required />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input className="bg-white text-neutral-900" name="phone" value={form.phone} onChange={onChange} inputMode="numeric" maxLength={15} placeholder="10 to 15 digits" />
          </div>
          <div>
            <Label>Mobile *</Label>
            <Input className="bg-white text-neutral-900" name="mobile" value={form.mobile} onChange={onChange} inputMode="numeric" maxLength={15} placeholder="10 to 15 digits" required />
          </div>
          <div className="md:col-span-2">
            <Label>Address 1</Label>
            <Textarea className="bg-white text-neutral-900" name="address1" value={form.address1} onChange={onChange} />
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">Location & User Type</div>
          <div>
            <Label>PinCode</Label>
            <Input className="bg-white text-neutral-900" name="pincode" value={form.pincode} onChange={onChange} />
          </div>
          {isSingleZoneRole(form.role) ? (
            <div>
              <Label>Zone *</Label>
              <Select value={form.zone} onValueChange={(zone) => setForm((f) => ({ ...f, zone, zones: zone ? [zone] : [], cluster: '' }))}>
                <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Zone" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="md:col-span-2">
              <Label>Zones *</Label>
              <p className="text-xs text-neutral-500 mb-2">Select one or more zones. Only BDE is limited to a single zone.</p>
              <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {zones.map((z) => (
                  <label key={z} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.zones.includes(z)}
                      onChange={() =>
                        setForm((f) => {
                          const next = f.zones.includes(z) ? f.zones.filter((name) => name !== z) : [...f.zones, z]
                          return { ...f, zones: next, zone: next[0] || '' }
                        })
                      }
                    />
                    {z}
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.role === 'Executive' && (
            <div className="md:col-span-2">
              <Label>Cluster *</Label>
              <Select value={form.cluster} onValueChange={(cluster) => setForm((f) => ({ ...f, cluster }))}>
                <SelectTrigger className="bg-white text-neutral-900"><SelectValue placeholder="Select Cluster" /></SelectTrigger>
                <SelectContent>
                  {(clustersByZone[form.zone] || []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>District</Label>
            <Input className="bg-white text-neutral-900" name="district" value={form.district} onChange={onChange} />
          </div>
          <div>
            <Label>City</Label>
            <Input className="bg-white text-neutral-900" name="city" value={form.city} onChange={onChange} />
          </div>
          <div>
            <Label>State *</Label>
            <Input className="bg-white text-neutral-900" name="state" value={form.state} onChange={onChange} required />
          </div>
          <div>
            <Label>User Type *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => {
              const single = isSingleZoneRole(v)
              const nextZones = single ? (f.zone ? [f.zone] : f.zones.slice(0, 1)) : (f.zones.length ? f.zones : f.zone ? [f.zone] : [])
              const allowed = new Set(filterTagOptions(tagOptions, v).map((e) => e._id))
              return {
                ...f,
                role: v,
                zone: nextZones[0] || '',
                zones: nextZones,
                cluster: single ? f.cluster : '',
                taggedEmployeeIds: f.taggedEmployeeIds.filter((id) => allowed.has(id)),
              }
            })}>
              <SelectTrigger className="bg-white text-neutral-900"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Executive', 'Trainer', 'Finance Manager', 'HR Manager', 'HR Executive', 'Coordinator', 'Senior Coordinator', 'Manager', 'Executive Manager', 'Regional Manager', 'Regional Head', 'National Head', 'Warehouse Executive', 'Warehouse Manager', 'Admin', 'Super Admin'].map((r) => (
                  <SelectItem key={r} value={r}>{displayRoleName(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supportsEmployeeTagging(form.role) && (
            <div className="md:col-span-2">
              <Label className="mb-2 block">{getTaggingSectionLabel(form.role)}</Label>
              <p className="text-xs text-neutral-500 mb-2">
                Tag only the next level: National Head, Regional Head, Regional Manager, Zonal Manager, Coordinators, then BDE.
              </p>
              <div className="max-h-48 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {filterTagOptions(tagOptions, form.role).length === 0 ? (
                  <p className="text-sm text-neutral-500">No employees at the next level are available to tag</p>
                ) : (
                  filterTagOptions(tagOptions, form.role).map((e) => (
                    <label key={e._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.taggedEmployeeIds.includes(e._id)}
                        onChange={() => toggleTagged(e._id)}
                      />
                      {e.name} ({displayRoleName(e.role)})
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
