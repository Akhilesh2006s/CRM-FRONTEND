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
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import {
  filterTagOptions,
  getTaggingSectionLabel,
  isSingleZoneRole,
  supportsEmployeeTagging,
} from '@/lib/employeeTagging'
import { sanitizePhoneInput, validateStrictIndianMobile } from '@/lib/phone'
import { displayRoleName } from '@/lib/roleLabels'
import {
  validateEmployeeFirstName,
  validateEmployeeLastName,
  validateEmployeeCode,
  validateEmployeeIdentityFields,
  type EmployeeIdentityErrors,
} from '@/lib/employeeFormValidation'

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
    temporaryAddress: '',
    permanentAddress: '',
    state: '',
    zone: '',
    zones: [] as string[],
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    taggedEmployeeIds: [] as string[],
    references: [
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
    ] as { relation: string; name: string; mobile: string; aadhaarUrl: string }[],
    aadhaarUrl: '',
    locationPhotoUrl: '',
  })
  const [uploadingAadhaar, setUploadingAadhaar] = useState(false)
  const [uploadingRefAadhaar, setUploadingRefAadhaar] = useState<number | null>(null)
  const [uploadingLocation, setUploadingLocation] = useState(false)
  const REFERENCE_RELATIONS = ['Wife', 'Husband', 'Brother', 'Sister', 'Father', 'Mother'] as const
  const [tagOptions, setTagOptions] = useState<EmployeeOption[]>([])
  const filteredTagOptions = useMemo(
    () => filterTagOptions(tagOptions, form.role),
    [tagOptions, form.role]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [sameAsPermanent, setSameAsPermanent] = useState(false)
  const [identityErrors, setIdentityErrors] = useState<EmployeeIdentityErrors>({})
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
    if (name === 'mobile' || name === 'phone') {
      const digits = sanitizePhoneInput(value, 15)
      setForm((f) => ({ ...f, [name]: digits }))
      if (name === 'mobile' && mobileError) setMobileError(null)
      if (name === 'phone' && phoneError) setPhoneError(null)
      return
    }
    if (name === 'permanentAddress') {
      setForm((f) => ({
        ...f,
        permanentAddress: value,
        ...(sameAsPermanent ? { temporaryAddress: value } : {}),
      }))
      return
    }
    setForm((f) => ({ ...f, [name]: value }))
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
          setForm((f) => {
            const zone = response.zone || f.zone
            const zones =
              isSingleZoneRole(f.role) || !zone || f.zones.includes(zone)
                ? f.zones
                : [...f.zones, zone]
            return {
              ...f,
              state: response.state || f.state,
              district: response.district || f.district,
              city: response.city || response.town || f.city,
              zone,
              zones,
              cluster: response.cluster || (response.zone ? '' : f.cluster),
            }
          })
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
    apiRequest<{ empCode: string }>('/employees/next-code')
      .then((data) => {
        if (data?.empCode) setForm((f) => ({ ...f, empCode: data.empCode }))
      })
      .catch(() => {})
  }, [])

  const toggleZone = (zoneName: string) => {
    setForm((f) => {
      const zones = f.zones.includes(zoneName)
        ? f.zones.filter((z) => z !== zoneName)
        : [...f.zones, zoneName]
      return { ...f, zones, zone: zones[0] || '' }
    })
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
    setMobileError(null)
    setPhoneError(null)
    try {
      const identityCheck = validateEmployeeIdentityFields({
        firstName: form.firstName,
        lastName: form.lastName,
        empCode: form.empCode || '0001',
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

      const temporaryAddress = sameAsPermanent
        ? form.permanentAddress
        : form.temporaryAddress

      if (!form.mobile.trim()) {
        const message = 'Employee mobile number is required.'
        setMobileError(message)
        setError(message)
        setSubmitting(false)
        return
      }
      const mobileCheck = validateStrictIndianMobile(form.mobile)
      if (!mobileCheck.ok) {
        setMobileError(mobileCheck.message)
        setError(mobileCheck.message)
        setSubmitting(false)
        return
      }
      if (!form.phone.trim()) {
        const message = 'Company contact number is required.'
        setPhoneError(message)
        setError(message)
        setSubmitting(false)
        return
      }
      const phoneCheck = validateStrictIndianMobile(form.phone)
      if (!phoneCheck.ok) {
        setPhoneError('Company contact number must be 10 to 15 digits.')
        setError('Company contact number must be 10 to 15 digits.')
        setSubmitting(false)
        return
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

      for (let i = 0; i < 2; i++) {
        const ref = form.references[i]
        if (!REFERENCE_RELATIONS.includes(ref.relation as any)) {
          setError(`Reference ${i + 1}: select relationship (Wife, Husband, Brother, Sister, Father, or Mother)`)
          setSubmitting(false)
          return
        }
        if (!ref.name.trim()) {
          setError(`Reference ${i + 1}: name is required`)
          setSubmitting(false)
          return
        }
        const refMobile = validateStrictIndianMobile(ref.mobile)
        if (!refMobile.ok) {
          setError(`Reference ${i + 1}: ${refMobile.message}`)
          setSubmitting(false)
          return
        }
        if (!ref.aadhaarUrl.trim()) {
          setError(`Reference ${i + 1}: Aadhaar PDF is required`)
          setSubmitting(false)
          return
        }
      }
      const refMobiles = form.references.map((r) => {
        const m = validateStrictIndianMobile(r.mobile)
        return m.ok ? m.digits : r.mobile.trim()
      })
      if (refMobiles[0] && refMobiles[0] === refMobiles[1]) {
        setError('Reference 1 and Reference 2 cannot have the same mobile number')
        setSubmitting(false)
        return
      }
      if (!form.permanentAddress.trim()) {
        setError('Permanent address is required')
        setSubmitting(false)
        return
      }
      if (!temporaryAddress.trim()) {
        setError('Temporary address is required')
        setSubmitting(false)
        return
      }
      if (!form.aadhaarUrl.trim()) {
        setError('Aadhaar upload is required')
        setSubmitting(false)
        return
      }
      if (!form.locationPhotoUrl.trim()) {
        setError('Location upload is required')
        setSubmitting(false)
        return
      }
      
      const payload: any = {
        ...form,
        firstName: identityCheck.values.firstName,
        lastName: identityCheck.values.lastName,
        empCode: identityCheck.values.empCode,
        phone: phoneCheck.digits,
        mobile: mobileCheck.digits,
        temporaryAddress,
        permanentAddress: form.permanentAddress,
        zone: selectedZones[0],
        zones: selectedZones,
        name:
          `${identityCheck.values.firstName} ${identityCheck.values.lastName}`.trim() ||
          identityCheck.values.firstName ||
          'Executive',
        address1: temporaryAddress,
        references: form.references.map((r) => {
          const m = validateStrictIndianMobile(r.mobile)
          return { ...r, mobile: m.ok ? m.digits : r.mobile }
        }),
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
      if (getCurrentUser()?.role === 'HR Executive') {
        toast.success('Employee request sent to the HR Manager. They are added only after approval.')
        router.push('/dashboard/employees/requests')
      } else {
        toast.success('Employee added.')
        router.push('/dashboard/employees/active')
      }
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
            <Input
              className={`bg-white text-neutral-900 ${identityErrors.firstName ? 'border-red-500' : ''}`}
              name="firstName"
              value={form.firstName}
              onChange={onChange}
              onBlur={onIdentityBlur}
              placeholder="First Name"
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
              placeholder="Last Name"
            />
            {identityErrors.lastName && (
              <p className="text-xs text-red-600 mt-1">{identityErrors.lastName}</p>
            )}
          </div>
          <div>
            <Label>Emp ID</Label>
            <p className="text-xs text-neutral-500 mb-1">VESPL (code)</p>
            <Input
              className="bg-neutral-100 text-neutral-900"
              name="empCode"
              value={form.empCode}
              readOnly
              placeholder="0001"
            />
          </div>
          <div>
            <Label>Email Id *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} placeholder="Email" required />
          </div>
          <div>
            <Label>Contact No (Company) *</Label>
            <Input
              className={`bg-white text-neutral-900 ${phoneError ? 'border-red-500' : ''}`}
              name="phone"
              value={form.phone}
              onChange={onChange}
              placeholder="10 to 15 digits"
              inputMode="numeric"
              maxLength={15}
              required
            />
            {phoneError && (
              <p className="text-xs text-red-600 mt-1">{phoneError}</p>
            )}
          </div>
          <div>
            <Label>Mobile No (Personal) *</Label>
            <Input
              className={`bg-white text-neutral-900 ${mobileError ? 'border-red-500' : ''}`}
              type="tel"
              inputMode="numeric"
              name="mobile"
              value={form.mobile}
              onChange={onChange}
              placeholder="10 to 15 digits"
              maxLength={15}
              required
            />
            {mobileError && (
              <p className="text-xs text-red-600 mt-1">{mobileError}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Permanent address *</Label>
            <Textarea
              className="bg-white text-neutral-900"
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={onChange}
              placeholder="Permanent address"
              required
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="sameAsPermanent"
              type="checkbox"
              className="h-4 w-4"
              checked={sameAsPermanent}
              onChange={(e) => {
                const checked = e.target.checked
                setSameAsPermanent(checked)
                if (checked) {
                  setForm((f) => ({ ...f, temporaryAddress: f.permanentAddress }))
                }
              }}
            />
            <Label htmlFor="sameAsPermanent" className="mb-0">
              Same as permanent address
            </Label>
          </div>
          <div className="md:col-span-2">
            <Label>Temporary address *</Label>
            <Textarea
              className="bg-white text-neutral-900"
              name="temporaryAddress"
              value={sameAsPermanent ? form.permanentAddress : form.temporaryAddress}
              onChange={onChange}
              placeholder="Temporary / current address"
              readOnly={sameAsPermanent}
              required
            />
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">Documents *</div>
          <div>
            <Label>Aadhaar upload *</Label>
            <Input
              className="bg-white"
              type="file"
              accept="application/pdf,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                  setError('Only PDF files are allowed.')
                  e.target.value = ''
                  return
                }
                setUploadingAadhaar(true)
                setError(null)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  fd.append('kind', 'aadhaar')
                  const token = localStorage.getItem('authToken')
                  const { apiUrl } = await import('@/lib/api')
                  const res = await fetch(apiUrl('/employees/upload'), {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: fd,
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data?.message || 'Upload failed')
                  setForm((f) => ({ ...f, aadhaarUrl: data.url }))
                } catch (err: any) {
                  setError(err?.message || 'Aadhaar upload failed')
                } finally {
                  setUploadingAadhaar(false)
                }
              }}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {uploadingAadhaar ? 'Uploading…' : form.aadhaarUrl ? `Uploaded: ${form.aadhaarUrl}` : 'PDF only'}
            </p>
          </div>
          <div>
            <Label>Location upload *</Label>
            <Input
              className="bg-white"
              type="file"
              accept="application/pdf,.pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                  setError('Only PDF files are allowed.')
                  e.target.value = ''
                  return
                }
                setUploadingLocation(true)
                setError(null)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  fd.append('kind', 'location')
                  const token = localStorage.getItem('authToken')
                  const { apiUrl } = await import('@/lib/api')
                  const res = await fetch(apiUrl('/employees/upload'), {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: fd,
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data?.message || 'Upload failed')
                  setForm((f) => ({ ...f, locationPhotoUrl: data.url }))
                } catch (err: any) {
                  setError(err?.message || 'Location upload failed')
                } finally {
                  setUploadingLocation(false)
                }
              }}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {uploadingLocation
                ? 'Uploading…'
                : form.locationPhotoUrl
                  ? `Uploaded: ${form.locationPhotoUrl}`
                  : 'PDF only'}
            </p>
          </div>

          <div className="md:col-span-2 text-lg font-semibold mb-2 mt-4">References *</div>
          {[0, 1].map((idx) => (
            <div key={idx} className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4 border border-neutral-200 rounded p-3 bg-white">
              <div>
                <Label>Reference {idx + 1} — Relationship *</Label>
                <Select
                  value={form.references[idx].relation}
                  onValueChange={(v) =>
                    setForm((f) => {
                      const references = [...f.references]
                      references[idx] = { ...references[idx], relation: v }
                      return { ...f, references }
                    })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_RELATIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  className="bg-white"
                  value={form.references[idx].name}
                  onChange={(e) =>
                    setForm((f) => {
                      const references = [...f.references]
                      references[idx] = { ...references[idx], name: e.target.value }
                      return { ...f, references }
                    })
                  }
                  placeholder="Reference name"
                  required
                />
              </div>
              <div>
                <Label>Mobile *</Label>
                <Input
                  className="bg-white"
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  value={form.references[idx].mobile}
                  onChange={(e) =>
                    setForm((f) => {
                      const references = [...f.references]
                      references[idx] = {
                        ...references[idx],
                        mobile: sanitizePhoneInput(e.target.value),
                      }
                      return { ...f, references }
                    })
                  }
                  placeholder="10 to 15 digits"
                  required
                />
              </div>
              <div>
                <Label>Aadhaar upload *</Label>
                <Input
                  className="bg-white"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      setError('Only PDF files are allowed.')
                      e.target.value = ''
                      return
                    }
                    setUploadingRefAadhaar(idx)
                    setError(null)
                    try {
                      const fd = new FormData()
                      fd.append('file', file)
                      fd.append('kind', 'reference-aadhaar')
                      const token = localStorage.getItem('authToken')
                      const { apiUrl } = await import('@/lib/api')
                      const res = await fetch(apiUrl('/employees/upload'), {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: fd,
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data?.message || 'Upload failed')
                      setForm((f) => {
                        const references = [...f.references]
                        references[idx] = { ...references[idx], aadhaarUrl: data.url }
                        return { ...f, references }
                      })
                    } catch (err: any) {
                      setError(err?.message || `Reference ${idx + 1} Aadhaar upload failed`)
                    } finally {
                      setUploadingRefAadhaar(null)
                    }
                  }}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {uploadingRefAadhaar === idx
                    ? 'Uploading…'
                    : form.references[idx].aadhaarUrl
                      ? `Uploaded: ${form.references[idx].aadhaarUrl}`
                      : 'PDF only'}
                </p>
              </div>
            </div>
          ))}

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
          {isSingleZoneRole(form.role) ? (
            <div>
              <Label>Zone *</Label>
              <Select
                value={form.zone}
                onValueChange={(zone) =>
                  setForm((f) => ({
                    ...f,
                    zone,
                    zones: zone ? [zone] : [],
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
          ) : (
            <div className="md:col-span-2">
              <Label>Zones *</Label>
              <p className="text-xs text-neutral-500 mb-2">
                Select one or more zones. Only BDE is limited to a single zone.
              </p>
              <div className="max-h-40 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {zones.length === 0 ? (
                  <p className="text-sm text-neutral-500">No zones available</p>
                ) : (
                  zones.map((z) => (
                    <label key={z} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.zones.includes(z)}
                        onChange={() => toggleZone(z)}
                      />
                      {z}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          {form.role === 'Executive' && (
            <div className="md:col-span-2">
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
                  const single = isSingleZoneRole(v)
                  const zones = single
                    ? f.zone
                      ? [f.zone]
                      : f.zones.slice(0, 1)
                    : f.zones.length
                      ? f.zones
                      : f.zone
                        ? [f.zone]
                        : []
                  return {
                    ...f,
                    role: v,
                    zone: zones[0] || '',
                    zones,
                    cluster: single ? f.cluster : '',
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
                <SelectItem value="Executive">BDE</SelectItem>
                <SelectItem value="Trainer">Trainer</SelectItem>
                <SelectItem value="Finance Manager">Finance Manager</SelectItem>
                <SelectItem value="HR Manager">HR Manager</SelectItem>
                <SelectItem value="HR Executive">HR Executive</SelectItem>
                <SelectItem value="Coordinator">Coordinator</SelectItem>
                <SelectItem value="Senior Coordinator">Senior Coordinator</SelectItem>
                <SelectItem value="Manager">Product Manager</SelectItem>
                <SelectItem value="Executive Manager">Zonal Manager</SelectItem>
                <SelectItem value="Regional Manager">Regional Manager</SelectItem>
                <SelectItem value="Regional Head">Regional Head</SelectItem>
                <SelectItem value="National Head">National Head</SelectItem>
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
                Tag only the next level: National Head, Regional Head, Regional Manager, Zonal Manager, Coordinators, then BDE.
              </p>
              <div className="max-h-48 overflow-y-auto border rounded p-3 bg-white space-y-2">
                {filteredTagOptions.length === 0 ? (
                  <p className="text-sm text-neutral-500">No employees at the next level are available to tag</p>
                ) : (
                  filteredTagOptions.map((e) => (
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
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
