'use client'

import { useState, useEffect, useMemo } from 'react'
import { PayrollDetailsFields, emptyPayrollDetails, payrollDetailsFromEmployee, payrollDetailsPayload, type PayrollDetails } from '@/components/employees/PayrollDetailsFields'
import { BankDetailsFields, bankDetailsError, bankDetailsFromEmployee, bankDetailsPayload, emptyBankDetails, type BankDetails } from '@/components/employees/BankDetailsFields'
import { employeeDocHref, employeeDocName, PASSBOOK_ACCEPT, uploadEmployeeDoc } from '@/lib/employeeDocs'
import { formatEmployeeCode } from '@/lib/employeeCode'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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

type EmployeeOption = {
  _id: string
  name: string
  role: string
  assignedProductIds?: Array<string | { _id?: string }>
}
type ProductSchool = { schoolName: string; schoolCode: string; zone: string; cluster: string; zonalManager: string; contactPerson: string }
type ProductSchoolsResponse = { schools: ProductSchool[] }
const MULTI_ZONE_ROLES = ['Executive Manager', 'Trainer', 'Coordinator', 'Senior Coordinator']
const roleUsesZones = (role: string) => isSingleZoneRole(role) || MULTI_ZONE_ROLES.includes(role)
const roleRequiresZones = (role: string) =>
  isSingleZoneRole(role) || ['Trainer', 'Coordinator', 'Senior Coordinator'].includes(role)

/** Stored date as YYYY-MM-DD on the Indian calendar (how the forms save it). */
function dateInputValue(value: unknown): string {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10)
}

function datePartsOf(iso: string) {
  const [year = '', month = '', day = ''] = iso ? iso.split('-') : []
  return { day, month, year }
}

/** "Uploaded: <file>" with a link that opens the stored document. */
function UploadedDoc({ url, replaceHint }: { url: string; replaceHint?: boolean }) {
  return (
    <>
      Uploaded:{' '}
      <a href={employeeDocHref(url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        {employeeDocName(url)}
      </a>
      {replaceHint ? ' · choose a new file to replace it' : ''}
    </>
  )
}

export type EmployeeFormProps = {
  /** "edit" loads the employee and saves every create-time field except the password. */
  mode?: 'create' | 'edit'
  employeeId?: string
}

/** Add / edit employee form shared by /dashboard/employees/new and /dashboard/employees/edit/[id]. */
export function EmployeeForm({ mode = 'create', employeeId }: EmployeeFormProps) {
  const isEdit = mode === 'edit'
  const [payrollDetails, setPayrollDetails] = useState<PayrollDetails>(emptyPayrollDetails())
  const [bankDetails, setBankDetails] = useState<BankDetails>(emptyBankDetails())
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
    phone: '',
    mobile: '',
    hasEmployeeRelationship: null as boolean | null,
    employeeRelationshipDetails: { fullName: '', relationship: '', department: '', designation: '' },
    dateOfBirth: '',
    dateOfJoining: '',
    /** CTC per year (saved as the yearly salary) and the monthly take-home pay. */
    yearlySalary: '',
    monthlyTakeHome: '',
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
    trainerProducts: [] as string[],
    verticalManagerId: '',
    taggedEmployeeIds: [] as string[],
    references: [
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
    ] as { relation: string; name: string; mobile: string; aadhaarUrl: string }[],
    aadhaarUrl: '',
    locationPhotoUrl: '',
    bankPassbookUrl: '',
  })
  /** The saved employee in edit mode. Fields it never had (older records) may stay blank. */
  const [original, setOriginal] = useState<Record<string, any> | null>(null)
  const [loadingEmployee, setLoadingEmployee] = useState(isEdit)
  const [uploadingPassbook, setUploadingPassbook] = useState(false)
  const onFile = (key: string) => {
    const value = original?.[key]
    if (Array.isArray(value)) return value.length > 0
    if (key === 'phone') return Boolean(value) && value !== '0'
    if (typeof value === 'boolean') return true
    return value !== undefined && value !== null && value !== 0 && String(value).trim() !== ''
  }
  /** Required at creation; in edit mode only when the employee already has it on file. */
  const needs = (key: string) => !isEdit || onFile(key)
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
  const productHeads = useMemo(
    () => tagOptions.filter((employee) => employee.role === 'Manager'),
    [tagOptions]
  )
  const eligibleProductHeads = useMemo(() => {
    const selectedIds = productOptions
      .filter((product) => form.trainerProducts.includes(product.productName))
      .map((product) => product._id)
    if (!selectedIds.length) return productHeads
    return productHeads.filter((head) => {
      const assigned = new Set(
        (head.assignedProductIds || []).map((value) =>
          typeof value === 'string' ? value : String(value?._id || '')
        )
      )
      return selectedIds.every((id) => assigned.has(id))
    })
  }, [form.trainerProducts, productHeads, productOptions])

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
    apiRequest<ProductSchoolsResponse>(
      `/product-manager/products/${productId}/schools`
    )
      .then((data) => {
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

  const loadEmployee = async (id: string) => {
    const emp = await apiRequest<Record<string, any>>(`/employees/${id}`)
    const parts = String(emp.name || '').trim().split(/\s+/)
    const savedZones: string[] = Array.isArray(emp.zones) && emp.zones.length
      ? emp.zones
      : emp.zone
        ? [emp.zone]
        : []
    const refs: any[] = Array.isArray(emp.references) ? emp.references : []
    const refAt = (i: number) => ({
      relation: String(refs[i]?.relation || ''),
      name: String(refs[i]?.name || ''),
      mobile: String(refs[i]?.mobile || ''),
      aadhaarUrl: String(refs[i]?.aadhaarUrl || ''),
    })
    const relationship = emp.employeeRelationshipDetails || {}
    const dob = dateInputValue(emp.dateOfBirth)
    const doj = dateInputValue(emp.dateOfJoining)
    const permanentAddress = String(emp.permanentAddress || '')
    const temporaryAddress = String(emp.temporaryAddress || emp.address1 || '')
    setOriginal(emp)
    setForm((f) => ({
      ...f,
      firstName: emp.firstName || parts[0] || '',
      lastName: emp.lastName ?? parts.slice(1).join(' ') ?? '',
      empCode: emp.empCode ? formatEmployeeCode(emp.empCode, '') : '',
      email: emp.email || '',
      password: '',
      phone: emp.phone && emp.phone !== '0' ? String(emp.phone) : '',
      mobile: String(emp.mobile || ''),
      hasEmployeeRelationship: typeof emp.hasEmployeeRelationship === 'boolean' ? emp.hasEmployeeRelationship : null,
      employeeRelationshipDetails: {
        fullName: String(relationship.fullName || ''),
        relationship: String(relationship.relationship || ''),
        department: String(relationship.department || ''),
        designation: String(relationship.designation || ''),
      },
      dateOfBirth: dob,
      dateOfJoining: doj,
      yearlySalary: emp.yearlySalary ? String(emp.yearlySalary) : '',
      monthlyTakeHome: emp.monthlyTakeHome ? String(emp.monthlyTakeHome) : '',
      passportPhotoUrl: String(emp.passportPhotoUrl || ''),
      onboardingChecklist: Array.isArray(emp.onboardingChecklist) ? emp.onboardingChecklist : [],
      onboardingOtherNote: String(emp.onboardingOtherNote || ''),
      address1: String(emp.address1 || ''),
      temporaryAddress,
      permanentAddress,
      state: String(emp.state || ''),
      zone: savedZones[0] || '',
      zones: savedZones,
      cluster: String(emp.cluster || ''),
      department: String(emp.department || ''),
      district: String(emp.district || ''),
      city: String(emp.city || ''),
      pincode: String(emp.pincode || ''),
      role: emp.role || 'Executive',
      designation: String(emp.designation || ''),
      trainerProducts: Array.isArray(emp.trainerProducts) ? emp.trainerProducts : [],
      verticalManagerId: emp.verticalManagerId ? String(emp.verticalManagerId?._id || emp.verticalManagerId) : '',
      taggedEmployeeIds: (Array.isArray(emp.taggedEmployeeIds) ? emp.taggedEmployeeIds : []).map((x: any) => String(x?._id || x)),
      references: [refAt(0), refAt(1)],
      aadhaarUrl: String(emp.aadhaarUrl || ''),
      locationPhotoUrl: String(emp.locationPhotoUrl || ''),
      bankPassbookUrl: String(emp.bankPassbookUrl || ''),
    }))
    setDobParts(datePartsOf(dob))
    setDojParts(datePartsOf(doj))
    setSameAsPermanent(Boolean(permanentAddress.trim()) && permanentAddress === temporaryAddress)
    setPayrollDetails(payrollDetailsFromEmployee(emp))
    setBankDetails(bankDetailsFromEmployee(emp))
    const productIds = Array.isArray(emp.assignedProductIds) ? emp.assignedProductIds : []
    setProductId(productIds.length ? String(productIds[0]?._id || productIds[0]) : '')
  }

  useEffect(() => {
    loadZones()
    apiRequest<EmployeeOption[]>('/employees?isActive=true')
      .then((data) => setTagOptions(Array.isArray(data) ? data.filter((e) => e._id !== employeeId) : []))
      .catch(() => setTagOptions([]))
    if (isEdit) {
      if (!employeeId) return
      setLoadingEmployee(true)
      loadEmployee(employeeId)
        .catch((err: any) => toast.error(err?.message || 'Failed to load employee'))
        .finally(() => setLoadingEmployee(false))
      return
    }
    apiRequest<{ empCode: string }>('/employees/next-code')
      .then((data) => {
        if (data?.empCode) setForm((f) => ({ ...f, empCode: data.empCode }))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, employeeId])

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
        empCode: form.empCode || 'VESPL0001',
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
      if (!form.phone.trim() && needs('phone')) {
        const message = 'Company contact number is required.'
        setPhoneError(message)
        setError(message)
        setSubmitting(false)
        return
      }
      const phoneCheck = validateStrictIndianMobile(form.phone)
      if (form.phone.trim() && !phoneCheck.ok) {
        setPhoneError('Company contact number must be 10 to 15 digits.')
        setError('Company contact number must be 10 to 15 digits.')
        setSubmitting(false)
        return
      }
      if (phoneCheck.ok && phoneCheck.digits === mobileCheck.digits) {
        const message = 'Official contact number and personal mobile number cannot be the same.'
        setPhoneError(message)
        setError(message)
        setSubmitting(false)
        return
      }
      if (form.hasEmployeeRelationship === null && needs('hasEmployeeRelationship')) {
        setError('Select Yes or No for the employee relationship declaration')
        setSubmitting(false)
        return
      }
      if (form.hasEmployeeRelationship) {
        const relationship = form.employeeRelationshipDetails
        if (!relationship.fullName.trim() || !relationship.relationship.trim() || !relationship.department.trim() || !relationship.designation.trim()) {
          setError('Enter the full name, relationship, department, and designation of the employee connection')
          setSubmitting(false)
          return
        }
      }
      if (!form.dateOfBirth && needs('dateOfBirth')) {
        setError('Date of birth is required')
        setSubmitting(false)
        return
      }
      if (form.dateOfBirth > todayDate()) {
        setError('Date of birth cannot be a future date')
        setSubmitting(false)
        return
      }
      if (!form.dateOfJoining && needs('dateOfJoining')) {
        setError('Date of joining is required')
        setSubmitting(false)
        return
      }
      if (form.dateOfJoining > todayDate()) {
        setError('Date of joining cannot be a future date')
        setSubmitting(false)
        return
      }
      const bankError = bankDetailsError(bankDetails)
      if (bankError) {
        setError(bankError)
        setSubmitting(false)
        return
      }
      const ctc = Number(form.yearlySalary)
      if (!(ctc > 0) && (needs('yearlySalary') || form.yearlySalary.trim() !== '')) {
        setError('CTC (per year) is required')
        setSubmitting(false)
        return
      }
      const takeHome = form.monthlyTakeHome.trim() === '' ? 0 : Number(form.monthlyTakeHome)
      if (!Number.isFinite(takeHome) || takeHome < 0) {
        setError('Monthly take-home must be a valid amount')
        setSubmitting(false)
        return
      }
      if (!form.passportPhotoUrl.trim() && needs('passportPhotoUrl')) {
        setError('Passport size photo PDF is required')
        setSubmitting(false)
        return
      }

      if (form.role === 'Office Team' && !form.designation.trim()) {
        setError('Enter the designation')
        setSubmitting(false)
        return
      }

      const selectedZones = !roleUsesZones(form.role)
        ? []
        : isSingleZoneRole(form.role)
        ? form.zone.trim()
          ? [form.zone.trim()]
          : []
        : form.zones.map((z) => z.trim()).filter(Boolean)
      if (roleRequiresZones(form.role) && selectedZones.length === 0) {
        setError(isSingleZoneRole(form.role) ? 'Zone is required for BDE' : 'Select at least one zone')
        setSubmitting(false)
        return
      }
      if (isSingleZoneRole(form.role) && !form.cluster?.trim()) {
        setError('Cluster is required for BDE role')
        setSubmitting(false)
        return
      }

      // Older employees may have no references yet; leave them blank or fill both.
      const skipReferences =
        isEdit &&
        !onFile('references') &&
        form.references.every((r) => !r.relation && !r.name.trim() && !r.mobile.trim() && !r.aadhaarUrl)
      for (let i = 0; i < (skipReferences ? 0 : 2); i++) {
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
      if (!form.permanentAddress.trim() && needs('permanentAddress')) {
        setError('Permanent address is required')
        setSubmitting(false)
        return
      }
      if (!temporaryAddress.trim() && (needs('temporaryAddress') || (isEdit && onFile('address1')))) {
        setError('Temporary address is required')
        setSubmitting(false)
        return
      }
      if (!form.aadhaarUrl.trim() && needs('aadhaarUrl')) {
        setError('Aadhaar upload is required')
        setSubmitting(false)
        return
      }
      if (!form.locationPhotoUrl.trim() && needs('locationPhotoUrl')) {
        setError('Location upload is required')
        setSubmitting(false)
        return
      }
      const keepLegacyManager = isEdit && original?.role === 'Manager' && !onFile('assignedProductIds') && !productId
      const keepLegacyTrainer =
        isEdit && original?.role === 'Trainer' && !onFile('trainerProducts') && !form.trainerProducts.length && !form.verticalManagerId
      if (form.role === 'Manager' && !productId && !keepLegacyManager) {
        setError('Select the product for this Product Manager')
        setSubmitting(false)
        return
      }
      if (form.role === 'Trainer' && !keepLegacyTrainer) {
        if (!form.trainerProducts.length) {
          setError('Select at least one product for this Trainer')
          setSubmitting(false)
          return
        }
        if (!form.verticalManagerId) {
          setError('Select the Product Head for this Trainer')
          setSubmitting(false)
          return
        }
      }
      const skipOnboarding = isEdit && !onFile('onboardingChecklist') && form.onboardingChecklist.length === 0
      if (form.onboardingChecklist.length < 2 && !skipOnboarding) {
        setError('Select at least two onboarding checklist items')
        setSubmitting(false)
        return
      }
      
      const payload: any = {
        ...form,
        firstName: identityCheck.values.firstName,
        lastName: identityCheck.values.lastName,
        empCode: identityCheck.values.empCode,
        phone: phoneCheck.ok ? phoneCheck.digits : '',
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
        yearlySalary: Number(form.yearlySalary),
        ...payrollDetailsPayload(payrollDetails),
        ...bankDetailsPayload(bankDetails),
        monthlyTakeHome: form.monthlyTakeHome.trim() === '' ? 0 : Number(form.monthlyTakeHome),
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
      if (form.role === 'Manager' && productId) {
        payload.assignedProductIds = [productId]
      }
      if (isEdit) {
        delete payload.password
        if (!form.empCode.trim()) delete payload.empCode
        if (form.hasEmployeeRelationship === null) {
          delete payload.hasEmployeeRelationship
          delete payload.employeeRelationshipDetails
        }
        if (skipOnboarding) {
          delete payload.onboardingChecklist
          delete payload.onboardingOtherNote
        }
        if (form.role === 'Trainer' && keepLegacyTrainer) {
          delete payload.trainerProducts
          delete payload.verticalManagerId
        }
        if (!temporaryAddress.trim()) delete payload.address1
        await apiRequest(`/employees/${employeeId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast.success('Employee updated')
        // Back to the list the edit was opened from (active, inactive or verification).
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push('/dashboard/employees/active')
        return
      }
      await apiRequest('/employees/create', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (getCurrentUser()?.role === 'Super Admin') {
        toast.success('Employee added.')
        router.push('/dashboard/employees/active')
      } else if (getCurrentUser()?.role === 'HR Executive' || getCurrentUser()?.role === 'HR Manager') {
        toast.success('Employee saved. Their Vertical Head will complete background verification before HR final approval.')
        router.push('/dashboard/employees/verification')
      } else {
        toast.success('Employee saved. The Vertical Head must approve before HR final approval.')
        router.push('/dashboard/employees/verification')
      }
    } catch (err: any) {
      setError(err?.message || (isEdit ? 'Failed to update employee' : 'Failed to create employee'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingEmployee) return <div className="p-6">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">{isEdit ? 'Edit Employee' : 'Add New Employee'}</h1>
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
            <Input
              className={isEdit ? `bg-white text-neutral-900 ${identityErrors.empCode ? 'border-red-500' : ''}` : 'bg-neutral-100 text-neutral-900'}
              name="empCode"
              value={form.empCode}
              readOnly={!isEdit}
              onChange={isEdit ? onChange : undefined}
              onBlur={isEdit ? onIdentityBlur : undefined}
              placeholder="0001"
            />
            {isEdit && identityErrors.empCode && (
              <p className="text-xs text-red-600 mt-1">{identityErrors.empCode}</p>
            )}
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
            <Label htmlFor="yearlySalary">CTC (₹ per year) *</Label>
            <Input
              id="yearlySalary"
              type="number"
              min="0"
              step="1"
              className="bg-white text-neutral-900"
              value={form.yearlySalary}
              onChange={(e) => setForm({ ...form, yearlySalary: e.target.value })}
              placeholder="e.g. 360000"
            />
            {Number(form.yearlySalary) > 0 && (
              <p className="text-xs text-neutral-500 mt-1">
                ₹{Math.round(Number(form.yearlySalary) / 12).toLocaleString('en-IN')} per month
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="monthlyTakeHome">Monthly take-home (₹)</Label>
            <Input
              id="monthlyTakeHome"
              type="number"
              min="0"
              step="1"
              className="bg-white text-neutral-900"
              value={form.monthlyTakeHome}
              onChange={(e) => setForm({ ...form, monthlyTakeHome: e.target.value })}
              placeholder="After deductions"
            />
          </div>
          <PayrollDetailsFields value={payrollDetails} onChange={setPayrollDetails} />
          <BankDetailsFields value={bankDetails} onChange={setBankDetails} />
          <div className="md:col-span-2">
            <Label htmlFor="bankPassbook">Bank passbook / cancelled cheque (PDF or image)</Label>
            <Input
              id="bankPassbook"
              className="bg-white"
              type="file"
              accept={PASSBOOK_ACCEPT}
              onChange={async (e) => {
                const input = e.target
                const file = input.files?.[0]
                if (!file) return
                setUploadingPassbook(true)
                setError(null)
                try {
                  const url = await uploadEmployeeDoc(file, 'passbook')
                  setForm((f) => ({ ...f, bankPassbookUrl: url }))
                } catch (err: any) {
                  setError(err?.message || 'Passbook upload failed')
                  input.value = ''
                } finally {
                  setUploadingPassbook(false)
                }
              }}
            />
            <p className="text-xs text-neutral-500 mt-1">
              {uploadingPassbook ? (
                'Uploading…'
              ) : form.bankPassbookUrl ? (
                <>
                  <UploadedDoc url={form.bankPassbookUrl} replaceHint />
                  {' · '}
                  <button type="button" className="text-red-600 underline" onClick={() => setForm((f) => ({ ...f, bankPassbookUrl: '' }))}>
                    Remove
                  </button>
                </>
              ) : (
                'Optional · PDF, JPG or PNG'
              )}
            </p>
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
          <fieldset className="md:col-span-2 rounded-lg border border-neutral-200 bg-white p-4">
            <legend className="px-1 text-base font-semibold text-neutral-900">
              Employee Relationship Declaration *
            </legend>
            <p className="mt-1 text-sm text-neutral-700">
              Do you have any relatives, family members, or personal connections currently employed by Viswam EduTech Solutions Pvt. Ltd.?
            </p>
            <RadioGroup
              className="mt-4 grid max-w-md grid-cols-2 gap-3"
              value={
                form.hasEmployeeRelationship === null
                  ? undefined
                  : form.hasEmployeeRelationship
                    ? 'yes'
                    : 'no'
              }
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  hasEmployeeRelationship: value === 'yes',
                  ...(value === 'no'
                    ? { employeeRelationshipDetails: { fullName: '', relationship: '', department: '', designation: '' } }
                    : {}),
                }))
              }
            >
              <Label
                htmlFor="employee-relationship-yes"
                className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 px-5 py-3 text-base font-semibold transition ${
                  form.hasEmployeeRelationship === true
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-blue-300'
                }`}
              >
                <RadioGroupItem value="yes" id="employee-relationship-yes" />
                Yes
              </Label>
              <Label
                htmlFor="employee-relationship-no"
                className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border-2 px-5 py-3 text-base font-semibold transition ${
                  form.hasEmployeeRelationship === false
                    ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-blue-300'
                }`}
              >
                <RadioGroupItem value="no" id="employee-relationship-no" />
                No
              </Label>
            </RadioGroup>
            {form.hasEmployeeRelationship === true && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="relationship-full-name">Full Name *</Label>
                  <Input
                    id="relationship-full-name"
                    className="mt-1 bg-white text-neutral-900"
                    value={form.employeeRelationshipDetails.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        employeeRelationshipDetails: {
                          ...current.employeeRelationshipDetails,
                          fullName: event.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="relationship-type">Relationship *</Label>
                  <Input
                    id="relationship-type"
                    className="mt-1 bg-white text-neutral-900"
                    value={form.employeeRelationshipDetails.relationship}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        employeeRelationshipDetails: {
                          ...current.employeeRelationshipDetails,
                          relationship: event.target.value,
                        },
                      }))
                    }
                    placeholder="e.g. Brother, spouse, friend"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="relationship-department">Department *</Label>
                  <Input
                    id="relationship-department"
                    className="mt-1 bg-white text-neutral-900"
                    value={form.employeeRelationshipDetails.department}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        employeeRelationshipDetails: {
                          ...current.employeeRelationshipDetails,
                          department: event.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="relationship-designation">Designation *</Label>
                  <Input
                    id="relationship-designation"
                    className="mt-1 bg-white text-neutral-900"
                    value={form.employeeRelationshipDetails.designation}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        employeeRelationshipDetails: {
                          ...current.employeeRelationshipDetails,
                          designation: event.target.value,
                        },
                      }))
                    }
                    required
                  />
                </div>
              </div>
            )}
          </fieldset>
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
              {uploadingAadhaar ? 'Uploading…' : form.aadhaarUrl ? <UploadedDoc url={form.aadhaarUrl} replaceHint={isEdit} /> : 'PDF only'}
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
                  ? <UploadedDoc url={form.locationPhotoUrl} replaceHint={isEdit} />
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
              {uploadingPassport ? 'Uploading…' : form.passportPhotoUrl ? <UploadedDoc url={form.passportPhotoUrl} replaceHint={isEdit} /> : 'PDF only'}
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
                      ? <UploadedDoc url={form.references[idx].aadhaarUrl} replaceHint={isEdit} />
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
          {!roleUsesZones(form.role) ? null : isSingleZoneRole(form.role) ? (
            <div>
              <Label>{isSingleZoneRole(form.role) ? 'BDE Zone *' : 'Zone *'}</Label>
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
              <p className="mt-1 text-xs text-neutral-500">
                Required. This zone routes the BDE approval to its assigned Zonal Manager.
              </p>
            </div>
          ) : (
            <div className="md:col-span-2">
              <Label>Zones{form.role === 'Executive Manager' ? ' (optional)' : ' *'}</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {form.role === 'Executive Manager'
                  ? 'You may create the Zonal Manager first and assign zones later from Zones & Clusters.'
                  : 'Select one or more zones. Only BDE is limited to a single zone.'}
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
                  const usesZones = roleUsesZones(v)
                  const zones = !usesZones
                    ? []
                    : single
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
                    zone: usesZones ? zones[0] || '' : '',
                    zones,
                    cluster: single ? f.cluster : '',
                    trainerProducts: v === 'Trainer' ? f.trainerProducts : [],
                    verticalManagerId: v === 'Trainer' ? f.verticalManagerId : '',
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
                <SelectItem value="Finance Executive">Finance Executive</SelectItem>
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
          {form.role === 'Trainer' && (
            <div className="md:col-span-2 space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
              <div>
                <Label>Trainer Products *</Label>
                <p className="mt-1 text-xs text-neutral-500">
                  Select every product this trainer can handle. The Product Head dashboard will show only matching trainers.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {productOptions.map((product) => (
                    <label key={product._id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.trainerProducts.includes(product.productName)}
                        onChange={() =>
                          setForm((current) => {
                            const selected = current.trainerProducts.includes(product.productName)
                              ? current.trainerProducts.filter((name) => name !== product.productName)
                              : [...current.trainerProducts, product.productName]
                            return { ...current, trainerProducts: selected }
                          })
                        }
                      />
                      {product.productName}
                    </label>
                  ))}
                </div>
                {!productsLoading && productOptions.length === 0 && (
                  <p className="mt-2 text-sm text-amber-700">No active products are available.</p>
                )}
              </div>
              <div>
                <Label>Product Head *</Label>
                <Select
                  value={form.verticalManagerId || undefined}
                  onValueChange={(value) => setForm((current) => ({ ...current, verticalManagerId: value }))}
                  disabled={!form.trainerProducts.length || eligibleProductHeads.length === 0}
                >
                  <SelectTrigger className="bg-white text-neutral-900">
                    <SelectValue placeholder="Select Product Head" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleProductHeads.map((head) => (
                      <SelectItem key={head._id} value={head._id}>{head.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.trainerProducts.length > 0 && eligibleProductHeads.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Assign the selected product(s) to a Product Head first.
                  </p>
                )}
              </div>
            </div>
          )}
          {!isEdit && (
            <div>
              <Label>Password *</Label>
              <Input className="bg-white text-neutral-900" type="password" name="password" value={form.password} onChange={onChange} required />
            </div>
          )}
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
              <div className="text-lg font-semibold mb-1">Onboarding checklist *</div>
              <p className="mb-2 text-xs text-neutral-600">Select at least two items.</p>
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
          <div className="md:col-span-2 flex justify-end gap-2">
            {isEdit && (
              <Button type="button" variant="outline" disabled={submitting} onClick={() => router.back()}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting || uploadingPassbook}>
              {submitting ? (isEdit ? 'Saving…' : 'Submitting…') : isEdit ? 'Save Changes' : 'Submit'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
