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
import { useProducts } from '@/hooks/useProducts'
import {
  validateEmployeeFirstName,
  validateEmployeeLastName,
  validateEmployeeCode,
  validateEmployeeIdentityFields,
  type EmployeeIdentityErrors,
} from '@/lib/employeeFormValidation'

type EmployeeOption = { _id: string; name: string; role: string }
type ProductSchool = { schoolName: string; schoolCode: string; zone: string; cluster: string; zonalManager: string; contactPerson: string }
type ProductSchoolsResponse = { schools: ProductSchool[] }

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
    dateOfBirth: '',
    dateOfJoining: '',
    passportPhotoUrl: '',
    onboardingChecklist: [] as string[],
    onboardingOtherNote: '',
    address1: '',
    temporaryAddress: '',
    permanentAddress: '',
    state: '',
    zone: '',
    zones: [] as string[],
    cluster: '',
    department: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    designation: '',
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
  const [uploadingPassport, setUploadingPassport] = useState(false)
  const ONBOARDING_ITEMS = [
    'App Training',
    'Account Session',
    'Product Training',
    'Visiting cards',
    'Id cards',
    'Sim',
    'Training Manuals',
    'Marketing Kit (BDE)',
    'Laptop',
    'Others',
  ]
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
  const { products: productOptions, loading: productsLoading } = useProducts()
  const [productId, setProductId] = useState('')
  const [productSchools, setProductSchools] = useState<ProductSchool[]>([])
  const [loadingProductSchools, setLoadingProductSchools] = useState(false)
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

  useEffect(() => {
    if (form.role !== 'Manager' || !productId) {
      setProductSchools([])
      return
    }
    let cancelled = false
    setLoadingProductSchools(true)
    apiRequest(
      `/product-manager/products/${productId}/schools`
    )
      .then((data: ProductSchoolsResponse) => {
        if (!cancelled) setProductSchools(Array.isArray(data?.schools) ? data.schools : [])
      })
      .catch(() => {
        if (!cancelled) setProductSchools([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProductSchools(false)
      })
    return () => {
      cancelled = true
    }
  }, [form.role, productId])

  const clearIdentityError = (field: keyof EmployeeIdentityErrors) => {
    setIdentityErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const todayDate = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  const dobYearNow = new Date().getFullYear()
  const dobYears = Array.from({ length: dobYearNow - 1939 }, (_, index) => String(dobYearNow - index))
  const dobMonths = [
    ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'],
    ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Aug'],
    ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
  ] as const
  const [dobParts, setDobParts] = useState({ day: '', month: '', year: '' })
  const [dojParts, setDojParts] = useState({ day: '', month: '', year: '' })

  const applyDateParts = (
    field: 'dateOfBirth' | 'dateOfJoining',
    next: { day: string; month: string; year: string },
    setParts: (value: { day: string; month: string; year: string }) => void,
    invalidMessage: string,
  ) => {
    setParts(next)
    if (!next.day || !next.month || !next.year) {
      setForm((current) => ({ ...current, [field]: '' }))
      return
    }
    const iso = `${next.year}-${next.month}-${next.day}`
    const parsed = new Date(`${iso}T00:00:00`)
    const real =
      parsed.getFullYear() === Number(next.year) &&
      parsed.getMonth() + 1 === Number(next.month) &&
      parsed.getDate() === Number(next.day)
    if (!real || iso > todayDate()) {
      setForm((current) => ({ ...current, [field]: '' }))
      setError(invalidMessage)
      return
    }
    setError(null)
    setForm((current) => ({ ...current, [field]: iso }))
  }

  const applyDob = (next: { day: string; month: string; year: string }) => {
    applyDateParts('dateOfBirth', next, setDobParts, 'Date of birth must be a past date')
  }

  const applyDoj = (next: { day: string; month: string; year: string }) => {
    applyDateParts('dateOfJoining', next, setDojParts, 'Date of joining must be a past date')
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
      if (phoneCheck.digits === mobileCheck.digits) {
        const message = 'Official contact number and personal mobile number cannot be the same.'
        setPhoneError(message)
        setError(message)
        setSubmitting(false)
        return
      }
      if (!form.dateOfBirth) {
        setError('Date of birth is required')
        setSubmitting(false)
        return
      }
      if (form.dateOfBirth > todayDate()) {
        setError('Date of birth cannot be a future date')
        setSubmitting(false)
        return
      }
      if (!form.dateOfJoining) {
        setError('Date of joining is required')
        setSubmitting(false)
        return
      }
      if (form.dateOfJoining > todayDate()) {
        setError('Date of joining cannot be a future date')
        setSubmitting(false)
        return
      }
      if (!form.passportPhotoUrl.trim()) {
        setError('Passport size photo PDF is required')
        setSubmitting(false)
        return
      }

      if (form.role === 'Office Team' && !form.designation.trim()) {
        setError('Enter the designation')
        setSubmitting(false)
        return
      }

      const selectedZones = isSingleZoneRole(form.role)
        ? form.zone.trim()
          ? [form.zone.trim()]
          : []
        : form.zones.map((z) => z.trim()).filter(Boolean)
      if (form.role !== 'Office Team' && selectedZones.length === 0) {
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
      if (form.role === 'Manager' && !productId) {
        setError('Select the product for this Product Manager')
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
      if (form.role === 'Manager') {
        payload.assignedProductIds = [productId]
      }
      await apiRequest('/employees/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (getCurrentUser()?.role === 'Super Admin') {
        toast.success('Employee added.')
        router.push('/dashboard/employees/active')
      } else if (getCurrentUser()?.role === 'HR Executive' || getCurrentUser()?.role === 'HR Manager') {
        toast.success('Employee saved. They can log in after the HR Manager and their head both approve.')
        router.push('/dashboard/employees/requests')
      } else {
        toast.success('Employee saved. They can log in after the HR Manager and their head both approve.')
        router.push('/dashboard/employees/verification')
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
            <Label>Date of birth *</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={dobParts.day || undefined} onValueChange={(day) => applyDob({ ...dobParts, day })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => (
                    <SelectItem key={day} value={day}>{Number(day)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dobParts.month || undefined} onValueChange={(month) => applyDob({ ...dobParts, month })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {dobMonths.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dobParts.year || undefined} onValueChange={(year) => applyDob({ ...dobParts, year })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {dobYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Date of joining *</Label>
            <div className="grid grid-cols-3 gap-2">
              <Select value={dojParts.day || undefined} onValueChange={(day) => applyDoj({ ...dojParts, day })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => (
                    <SelectItem key={day} value={day}>{Number(day)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dojParts.month || undefined} onValueChange={(month) => applyDoj({ ...dojParts, month })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {dobMonths.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dojParts.year || undefined} onValueChange={(year) => applyDoj({ ...dojParts, year })}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {dobYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <div>
            <Label>Passport size photo (PDF) *</Label>
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
                setUploadingPassport(true)
                setError(null)
                try {
                  const fd = new FormData()
                  fd.append('file', file)
                  fd.append('kind', 'passport')
                  const token = localStorage.getItem('authToken')
                  const { apiUrl } = await import('@/lib/api')
                  const res = await fetch(apiUrl('/employees/upload'), {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: fd,
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data?.message || 'Upload failed')
                  setForm((f) => ({ ...f, passportPhotoUrl: data.url }))
                } catch (err: any) {
                  setError(err?.message || 'Passport photo upload failed')
                } finally {
                  setUploadingPassport(false)
                }
              }}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {uploadingPassport ? 'Uploading…' : form.passportPhotoUrl ? `Uploaded: ${form.passportPhotoUrl}` : 'PDF only'}
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
              onValueChange={(v) => {
                if (v !== 'Manager') setProductId('')
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
              }}
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
                <SelectItem value="Office Team">Office Team</SelectItem>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === 'Office Team' && (
            <div>
              <Label>Designation *</Label>
              <Input
                className="bg-white text-neutral-900"
                name="designation"
                value={form.designation}
                onChange={onChange}
                placeholder="Enter designation"
                required
              />
            </div>
          )}
          {form.role === 'Manager' && (
            <div className="md:col-span-2 space-y-3">
              <div>
                <Label>Product *</Label>
                <Select value={productId || undefined} onValueChange={setProductId}>
                  <SelectTrigger className="bg-white text-neutral-900">
                    <SelectValue placeholder={productsLoading ? 'Loading products…' : 'Select product'} />
                  </SelectTrigger>
                  <SelectContent>
                    {productOptions.map((product) => (
                      <SelectItem key={product._id} value={product._id}>
                        {product.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-neutral-500 mt-1">
                  This Product Manager will see only the clients who asked for this product.
                </p>
              </div>
              {productId && (
                <div className="rounded border bg-white p-3">
                  <p className="text-sm font-medium text-neutral-800 mb-2">
                    Clients who asked for {productOptions.find((p) => p._id === productId)?.productName || 'this product'}
                  </p>
                  {loadingProductSchools ? (
                    <p className="text-sm text-neutral-500">Loading clients…</p>
                  ) : productSchools.length === 0 ? (
                    <p className="text-sm text-neutral-500">No client has asked for this product yet.</p>
                  ) : (
                    <ul className="max-h-48 overflow-y-auto divide-y text-sm">
                      {productSchools.map((school) => (
                        <li key={`${school.schoolCode}-${school.schoolName}`} className="py-2">
                          <span className="font-medium">{school.schoolName}</span>
                          {school.schoolCode ? <span className="text-neutral-500"> · {school.schoolCode}</span> : null}
                          <span className="text-neutral-500"> · Zone: {school.zone || '—'}</span>
                          <span className="text-neutral-500"> · Cluster: {school.cluster || '—'}</span>
                          <span className="text-neutral-500"> · Zonal Manager: {school.zonalManager || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Password *</Label>
            <Input className="bg-white text-neutral-900" type="password" name="password" value={form.password} onChange={onChange} required />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              className="bg-white text-neutral-900"
              name="department"
              value={form.department}
              onChange={onChange}
              placeholder="Department"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="mb-2 block">
              {supportsEmployeeTagging(form.role) ? getTaggingSectionLabel(form.role) : 'Employee tagging'}
            </Label>
            <p className="text-xs text-neutral-500 mb-2">
              {isSingleZoneRole(form.role)
                ? 'BDE is the last level, so a BDE does not tag anyone. Choose Coordinator or above to tag the next level: National Head → Regional Head → Regional Manager → Zonal Manager → Coordinators → BDE.'
                : supportsEmployeeTagging(form.role)
                  ? 'Tag only the next level down.'
                  : 'This user type is outside the sales hierarchy, so there is no one to tag.'}
            </p>
            {supportsEmployeeTagging(form.role) && (
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
            )}
          </div>

          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2">
              <div className="text-lg font-semibold mb-2">Onboarding checklist</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border rounded p-3 bg-white">
                {ONBOARDING_ITEMS.map((item) => (
                  <label key={item} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.onboardingChecklist.includes(item)}
                      onChange={() => {
                        setForm((f) => ({
                          ...f,
                          onboardingChecklist: f.onboardingChecklist.includes(item)
                            ? f.onboardingChecklist.filter((value) => value !== item)
                            : [...f.onboardingChecklist, item],
                        }))
                      }}
                    />
                    {item}
                  </label>
                ))}
              </div>
              {form.onboardingChecklist.includes('Others') && (
                <Input
                  className="bg-white text-neutral-900 mt-2"
                  name="onboardingOtherNote"
                  value={form.onboardingOtherNote}
                  onChange={onChange}
                  placeholder="Others"
                />
              )}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
