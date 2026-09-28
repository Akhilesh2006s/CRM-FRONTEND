'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { getCurrentUser } from '@/lib/auth'
import ChatbotWidget from '@/components/ChatbotWidget'
import { lookupPincode, type PostOfficeArea } from '@/lib/pincode'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import {
  validateContactMobile,
  validateContactPerson,
  validateSchoolName,
} from '@/lib/saleFormValidation'
import { normalizeIntegerInput } from '@/lib/numericInput'
import {
  LEAD_PRODUCT_STATUSES,
  validateLeadStyleProducts,
  type LeadProductStatus,
} from '@/lib/leadProductRules'

/** Create Sale School Type options (Super Admin / Coordinator). */
const CREATE_SALE_SCHOOL_TYPES = ['New', 'Existing'] as const
type CreateSaleSchoolType = (typeof CREATE_SALE_SCHOOL_TYPES)[number]

type ProductSelection = {
  name: string
  checked: boolean
  status: LeadProductStatus
  strength: string
  unit_price: string
  chance: string
  not_interested_reason: string
}

function normalizeCreateSaleSchoolType(value: unknown): CreateSaleSchoolType | '' {
  if (typeof value !== 'string') return ''
  return (CREATE_SALE_SCHOOL_TYPES as readonly string[]).includes(value)
    ? (value as CreateSaleSchoolType)
    : ''
}

export default function CreateDealPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const tenantId = currentUser?._id || ''
  const { productNames: availableProducts } = useProducts()
  const isSuperAdmin =
    currentUser?.role === 'Super Admin' || Boolean((currentUser as any)?.isSuperAdmin)
  
  const [form, setForm] = useState({
    school_type: '',
    school_name: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    contact_person2: '',
    contact_mobile2: '',
    location: '',
    address: '',
    pincode: '',
    state: '',
    city: '',
    region: '',
    area: '',
    lead_status: 'pending',
    zone: '',
    cluster: '',
    branches: '',
    strength: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  })

  const [areas, setAreas] = useState<PostOfficeArea[]>([])
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [pincodeError, setPincodeError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    school_name?: string
    contact_person?: string
    contact_mobile?: string
    contact_person2?: string
    contact_mobile2?: string
    follow_up_date?: string
    products?: string
  }>({})

  // Super Admin Create Sale: product checklist (reuse CRM product master)
  const [products, setProducts] = useState<ProductSelection[]>([])
  useEffect(() => {
    if (!isSuperAdmin) return
    if (availableProducts.length > 0 && products.length === 0) {
      setProducts(
        availableProducts.map((p) => ({
          name: p,
          checked: true,
          status: '' as const,
          strength: '',
          unit_price: '',
          chance: '',
          not_interested_reason: '',
        }))
      )
    }
  }, [availableProducts, isSuperAdmin, products.length])

  const handleProductStatusChange = (index: number, status: LeadProductStatus) => {
    const updated = [...products]
    updated[index].status = status
    if (status === 'Not Interested') {
      updated[index].strength = ''
      updated[index].unit_price = ''
      updated[index].chance = '0'
    } else if (status !== 'Hot' && status !== 'Warm') {
      updated[index].strength = ''
      updated[index].unit_price = ''
      updated[index].chance = ''
      updated[index].not_interested_reason = ''
    } else {
      if (updated[index].chance === '0') updated[index].chance = ''
      updated[index].not_interested_reason = ''
    }
    setProducts(updated)
    setFieldErrors((prev) => {
      if (!prev.products) return prev
      const next = { ...prev }
      delete next.products
      return next
    })
  }

  const handleProductStrengthChange = (index: number, raw: string) => {
    const updated = [...products]
    updated[index].strength = normalizeIntegerInput(raw)
    setProducts(updated)
  }

  const handleProductUnitPriceChange = (index: number, raw: string) => {
    let value = String(raw || '').replace(/[^\d.]/g, '')
    const parts = value.split('.')
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`
    if (value.startsWith('.')) value = `0${value}`
    const updated = [...products]
    updated[index].unit_price = value
    setProducts(updated)
  }

  const handleProductChanceChange = (index: number, raw: string) => {
    const updated = [...products]
    updated[index].chance = normalizeIntegerInput(raw, 100)
    setProducts(updated)
  }

  const handleNotInterestedReasonChange = (index: number, reason: string) => {
    const updated = [...products]
    updated[index].not_interested_reason = reason
    setProducts(updated)
  }
  
  const [zones, setZones] = useState<{ _id: string; name: string }[]>([])
  const [clusters, setClusters] = useState<string[]>([])
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Array<{ _id: string; name?: string }>>('/zones')
        setZones(
          (Array.isArray(data) ? data : [])
            .map((z) => ({ _id: z._id, name: z.name || '' }))
            .filter((z) => z.name)
        )
      } catch {
        setZones([])
      }
    })()
  }, [])
  useEffect(() => {
    const zoneName = form.zone.trim()
    if (!zoneName) {
      setClusters([])
      return
    }
    const match = zones.find((z) => z.name.toLowerCase() === zoneName.toLowerCase())
    if (!match) {
      setClusters([])
      return
    }
    ;(async () => {
      try {
        const data = await apiRequest<Array<{ name?: string }>>(`/zones/${match._id}/clusters`)
        setClusters(
          (Array.isArray(data) ? data : []).map((c) => c.name || '').filter(Boolean)
        )
      } catch {
        setClusters([])
      }
    })()
  }, [form.zone, zones])
  useEffect(() => {
    ;(async () => {
      setLoadingEmployees(true)
      try {
        const data = await apiRequest<any[]>('/employees?isActive=true&role=Executive')
        const list = Array.isArray(data) ? data : []
        setEmployees(list.map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' })).filter(e => e.name !== 'Unknown'))
      } catch (e) {
        console.error('Failed to load employees:', e)
        setEmployees([])
      } finally {
        setLoadingEmployees(false)
      }
    })()
  }, [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearFieldError = (name: string) => {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev
      const next = { ...prev }
      delete next[name as keyof typeof next]
      return next
    })
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    let nextValue = value
    if (name === 'contact_mobile' || name === 'contact_mobile2') {
      const hasNonDigits = /\D/.test(value)
      const digits = value.replace(/\D/g, '')
      nextValue = digits.slice(0, 15)
      if (hasNonDigits || digits.length > 15) {
        setFieldErrors((prev) => ({
          ...prev,
          [name]: 'Enter a phone number with 10 to 15 digits.',
        }))
      } else {
        clearFieldError(name)
      }
      setForm((f) => ({ ...f, [name]: nextValue }))
      return
    }
    if (name === 'school_name' && nextValue.length > 100) {
      nextValue = nextValue.slice(0, 100)
    }
    setForm((f) => ({ ...f, [name]: nextValue }))
    clearFieldError(name)
  }

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((f) => ({
      ...f,
      pincode,
    }))
    setPincodeError(null)

    if (pincode.length === 6) {
      setLoadingPincode(true)
      try {
        const response = await lookupPincode(pincode)

        if (response.success && response.town) {
          setForm((f) => ({
            ...f,
            city: response.district || '',
            state: response.state || '',
            region: response.region || '',
          }))
          setAreas(response.postOffices || [{ name: response.town, district: response.district || '' }])
        } else {
          setAreas([])
          setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }))
          const msg = response.message || 'Could not find this pincode.'
          setPincodeError(msg)
          toast.error(msg)
        }
      } catch (err: unknown) {
        console.error('Pincode lookup failed:', err)
        setAreas([])
        const msg =
          err instanceof Error ? err.message : 'Pincode lookup failed. Enter location manually.'
        setPincodeError(msg)
        toast.error(msg)
      } finally {
        setLoadingPincode(false)
      }
    } else if (pincode.length < 6) {
      setAreas([])
      setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }))
    }
  }

  // Callback function to handle form data from chatbot
  const handleChatbotFormData = (formData: any) => {
    if (!formData) return

    // Update form fields
    if (formData.school_name) setForm(prev => ({ ...prev, school_name: formData.school_name }))
    if (formData.school_type) {
      const schoolType = normalizeCreateSaleSchoolType(formData.school_type)
      if (schoolType) setForm(prev => ({ ...prev, school_type: schoolType }))
    }
    if (formData.contact_person) setForm(prev => ({ ...prev, contact_person: formData.contact_person }))
    if (formData.contact_mobile) setForm(prev => ({ ...prev, contact_mobile: formData.contact_mobile }))
    if (formData.email) setForm(prev => ({ ...prev, email: formData.email }))
    if (formData.contact_person2) setForm(prev => ({ ...prev, contact_person2: formData.contact_person2 }))
    if (formData.contact_mobile2) setForm(prev => ({ ...prev, contact_mobile2: formData.contact_mobile2 }))
    if (formData.location) setForm(prev => ({ ...prev, location: formData.location }))
    if (formData.address) setForm(prev => ({ ...prev, address: formData.address }))
    if (formData.pincode) setForm(prev => ({ ...prev, pincode: formData.pincode }))
    if (formData.state) setForm(prev => ({ ...prev, state: formData.state }))
    if (formData.city) setForm(prev => ({ ...prev, city: formData.city }))
    if (formData.region) setForm(prev => ({ ...prev, region: formData.region }))
    if (formData.area) setForm(prev => ({ ...prev, area: formData.area }))
    if (formData.zone) setForm(prev => ({ ...prev, zone: formData.zone }))
    if (formData.lead_status) setForm(prev => ({ ...prev, lead_status: formData.lead_status }))
    if (formData.branches) setForm(prev => ({ ...prev, branches: String(formData.branches) }))
    if (formData.strength) setForm(prev => ({ ...prev, strength: String(formData.strength) }))
    if (formData.remarks) setForm(prev => ({ ...prev, remarks: formData.remarks }))
    if (formData.follow_up_date) setForm(prev => ({ ...prev, follow_up_date: formData.follow_up_date }))
    if (formData.assigned_to) setForm(prev => ({ ...prev, assigned_to: formData.assigned_to }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const parseFollowUp = (s: string) => {
        if (!s) return undefined
        const norm = s.replace(/\//g, '-').trim()
        let iso: string | undefined
        if (/^\d{2}-\d{2}-\d{4}$/.test(norm)) {
          const [dd, mm, yyyy] = norm.split('-').map(Number)
          const d = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1))
          if (!isNaN(d.getTime())) iso = d.toISOString()
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(norm)) {
          const d = new Date(norm + 'T00:00:00Z')
          if (!isNaN(d.getTime())) iso = d.toISOString()
        }
        return iso
      }
      
      const nextFieldErrors: typeof fieldErrors = {}
      const schoolNameCheck = validateSchoolName(form.school_name)
      if (!schoolNameCheck.ok) nextFieldErrors.school_name = schoolNameCheck.message

      const contactPersonCheck = validateContactPerson(form.contact_person, {
        required: true,
        label: 'Contact person',
      })
      if (!contactPersonCheck.ok) nextFieldErrors.contact_person = contactPersonCheck.message

      const contactMobileCheck = validateContactMobile(form.contact_mobile, { required: true })
      if (!contactMobileCheck.ok) nextFieldErrors.contact_mobile = contactMobileCheck.message

      const contactPerson2Check = validateContactPerson(form.contact_person2, {
        required: true,
        label: 'Contact Person 2',
      })
      if (!contactPerson2Check.ok) nextFieldErrors.contact_person2 = contactPerson2Check.message

      const contactMobile2Check = validateContactMobile(form.contact_mobile2, { required: true })
      if (!contactMobile2Check.ok) nextFieldErrors.contact_mobile2 = contactMobile2Check.message

      if (!form.follow_up_date || !String(form.follow_up_date).trim()) {
        nextFieldErrors.follow_up_date = 'Follow-up Date is required.'
      }

      const selectedProducts = isSuperAdmin
        ? products.map((p) => {
            const strengthNum = Number(p.strength) || 0
            const chanceNum =
              p.status === 'Not Interested'
                ? 0
                : p.status === 'Hot' || p.status === 'Warm'
                  ? Number(p.chance) || 0
                  : 0
            const unitPriceNum =
              p.status === 'Hot' || p.status === 'Warm' ? Number(p.unit_price) || 0 : 0
            return {
              product_name: p.name,
              quantity: strengthNum > 0 ? strengthNum : 1,
              unit_price: unitPriceNum,
              strength: strengthNum,
              status: p.status,
              chance: chanceNum,
              term: 'Term 1',
              not_interested_reason:
                p.status === 'Not Interested' ? p.not_interested_reason.trim() : '',
            }
          })
        : []

      if (isSuperAdmin) {
        const productError = validateLeadStyleProducts(products)
        if (productError) nextFieldErrors.products = productError
      }

      setFieldErrors(nextFieldErrors)
      if (Object.keys(nextFieldErrors).length > 0) {
        const firstMessage = Object.values(nextFieldErrors)[0]
        throw new Error(firstMessage || 'Please fix the highlighted fields.')
      }
      if (
        !schoolNameCheck.ok ||
        !contactPersonCheck.ok ||
        !contactMobileCheck.ok ||
        !contactPerson2Check.ok ||
        !contactMobile2Check.ok
      ) {
        throw new Error('Please fix the highlighted fields.')
      }

      if (!form.email.trim()) {
        throw new Error('Email is required')
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) {
        throw new Error('Please enter a valid email address')
      }

      if (!form.assigned_to) {
        throw new Error('Please assign the deal to an executive. DC will not be created without assignment.')
      }

      if (!form.address || !form.address.trim()) {
        throw new Error('Address is required')
      }
      if (!form.branches || !String(form.branches).trim()) {
        throw new Error('No. of Branches is required')
      }
      if (!form.strength || !String(form.strength).trim()) {
        throw new Error('School Strength is required')
      }
      if (!form.remarks || !form.remarks.trim()) {
        throw new Error('Remarks is required')
      }

      const followUpIso = parseFollowUp(form.follow_up_date)
      if (!form.follow_up_date || !String(form.follow_up_date).trim() || !followUpIso) {
        setFieldErrors((prev) => ({ ...prev, follow_up_date: 'Follow-up Date is required.' }))
        throw new Error('Follow-up Date is required.')
      }

      const schoolPincode = form.pincode.replace(/\D/g, '').slice(0, 6)

      const payload: any = {
        school_name: schoolNameCheck.value,
        school_type: form.school_type || undefined,
        contact_person: contactPersonCheck.value,
        contact_mobile: contactMobileCheck.value,
        contact_person2: contactPerson2Check.value,
        contact_mobile2: contactMobile2Check.value,
        location: form.location,
        address: form.address.trim(),
        pincode: schoolPincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        zone: form.zone,
        cluster: form.cluster || undefined,
        status: form.lead_status || 'pending',
        branches: Number(form.branches),
        strength: Number(form.strength),
        remarks: form.remarks.trim(),
        email: form.email.trim(),
        products: selectedProducts,
        follow_up_date: followUpIso,
        assigned_to: form.assigned_to,
      }
      
      const created = await apiRequest<{
        _id?: string
        dc?: { _id?: string }
        dcCreated?: boolean
        healedOrphanDeal?: boolean
        assigned_to?: string | { _id?: string; name?: string }
        message?: string
      }>('/dc-orders/create', { method: 'POST', body: JSON.stringify(payload) })

      if (!created?.dc && !created?.dcCreated) {
        throw new Error(
          created?.message ||
            'Deal was not fully created: DC entry is missing. Please try again or contact support.'
        )
      }

      // Create Sale → Deal + DC → All Created DCs; assigned Executive sees Follow-up Leads.
      // Never send newly created DCs to Closed Sales.
      alert('Deal and DC created successfully.')

      const redirectPath =
        isSuperAdmin ||
        currentUser?.role === 'Admin' ||
        currentUser?.role === 'Coordinator' ||
        currentUser?.role === 'Senior Coordinator'
          ? '/dashboard/dc/admin/my'
          : currentUser?.role === 'Executive'
            ? '/dashboard/dc/my'
            : '/dashboard/dc/create'

      router.push(redirectPath)
    } catch (err: any) {
      setError(err?.message || 'Failed to create deal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Create Deal (Sale)</h1>
      <Link href="/dashboard/dc/grid" className="inline-block text-sm font-medium text-blue-700 underline">Create DC / Main DCs</Link>
      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 text-neutral-900">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>School name *</Label>
            <Input
              className={`bg-white text-neutral-900 ${fieldErrors.school_name ? 'border-red-500' : ''}`}
              name="school_name"
              value={form.school_name}
              onChange={onChange}
              maxLength={100}
              required
            />
            {fieldErrors.school_name && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.school_name}</p>
            )}
          </div>
          <div>
            <Label>School code</Label>
            <Input
              className="bg-neutral-100 text-neutral-700"
              value="Assigned automatically from the pincode, zone, and cluster"
              readOnly
              disabled
            />
          </div>
          <div>
            <Label>School Type</Label>
            <Select
              value={form.school_type}
              onValueChange={(v) => {
                const schoolType = normalizeCreateSaleSchoolType(v)
                if (schoolType) setForm((f) => ({ ...f, school_type: schoolType }))
              }}
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                {CREATE_SALE_SCHOOL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact person *</Label>
            <Input
              className={`bg-white text-neutral-900 ${fieldErrors.contact_person ? 'border-red-500' : ''}`}
              name="contact_person"
              value={form.contact_person}
              onChange={onChange}
              required
            />
            {fieldErrors.contact_person && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.contact_person}</p>
            )}
          </div>
          <div>
            <Label>Contact mobile *</Label>
            <Input
              className={`bg-white text-neutral-900 ${fieldErrors.contact_mobile ? 'border-red-500' : ''}`}
              name="contact_mobile"
              value={form.contact_mobile}
              onChange={onChange}
              inputMode="numeric"
              maxLength={15}
              required
            />
            {fieldErrors.contact_mobile && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.contact_mobile}</p>
            )}
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              className="bg-white text-neutral-900"
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              required
              placeholder="Enter email address"
            />
          </div>
          <div>
            <Label>Contact Person 2 *</Label>
            <Input
              className={`bg-white text-neutral-900 ${fieldErrors.contact_person2 ? 'border-red-500' : ''}`}
              name="contact_person2"
              value={form.contact_person2}
              onChange={onChange}
              required
            />
            {fieldErrors.contact_person2 && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.contact_person2}</p>
            )}
          </div>
          <div>
            <Label>Contact Mobile 2 *</Label>
            <Input
              className={`bg-white text-neutral-900 ${fieldErrors.contact_mobile2 ? 'border-red-500' : ''}`}
              name="contact_mobile2"
              value={form.contact_mobile2}
              onChange={onChange}
              inputMode="numeric"
              maxLength={15}
              required
            />
            {fieldErrors.contact_mobile2 && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.contact_mobile2}</p>
            )}
          </div>
          <div>
            <Label>Location/Town</Label>
            <Input className="bg-white text-neutral-900" name="location" value={form.location} onChange={onChange} />
          </div>
          <div>
            <Label>Pincode *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="pincode"
              value={form.pincode}
              onChange={handlePincodeChange}
              placeholder="Enter 6-digit pincode"
              maxLength={6}
              required
            />
            {loadingPincode && <p className="text-xs text-blue-600 mt-1">Loading location details...</p>}
            {pincodeError && !loadingPincode && (
              <p className="text-xs text-red-600 mt-1">{pincodeError}</p>
            )}
          </div>
          <div>
            <Label>State</Label>
            <Input className="bg-white text-neutral-900" name="state" value={form.state} onChange={onChange} />
          </div>
          <div>
            <Label>District</Label>
            <Input className="bg-white text-neutral-900" name="city" value={form.city} onChange={onChange} />
          </div>
          <div>
            <Label>City/Town</Label>
            <Input className="bg-white text-neutral-900" name="region" value={form.region} onChange={onChange} />
          </div>
          <div>
            <Label>Area / Locality</Label>
            <Select
              value={form.area || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
              disabled={areas.length === 0}
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder={areas.length === 0 ? 'Enter pincode first' : 'Select exact area'} />
              </SelectTrigger>
              <SelectContent>
                {areas
                  .filter((area) => area.name && area.name.trim() !== '')
                  .map((area, index) => {
                    const displayName = `${area.name}${area.block ? ` - ${area.block}` : ''}${area.branchType ? ` (${area.branchType})` : ''}`.trim()
                    return (
                      <SelectItem key={`${area.name}-${index}`} value={area.name}>
                        {displayName || area.name}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Address *</Label>
            <Textarea className="bg-white text-neutral-900" name="address" value={form.address} onChange={onChange} required />
          </div>

          {isSuperAdmin && (
            <div className="md:col-span-2 space-y-2">
              <Label>Products * (all required — cannot deselect)</Label>
              <div
                className={`p-4 bg-white rounded border ${
                  fieldErrors.products ? 'border-red-500' : 'border-neutral-200'
                }`}
              >
                {products.length === 0 ? (
                  <p className="text-sm text-neutral-500">Loading products...</p>
                ) : (
                  <>
                    <div className="hidden md:grid md:grid-cols-[minmax(120px,1fr)_130px_80px_88px_80px] gap-2 px-2 pb-2 border-b border-neutral-200 text-xs font-semibold text-neutral-600">
                      <span>Product</span>
                      <span>Status</span>
                      <span className="text-center">Strength</span>
                      <span className="text-center">Unit Price</span>
                      <span className="text-center">Chance %</span>
                    </div>
                    <div className="space-y-2">
                      {products.map((product, index) => {
                        const isHotOrWarm = product.status === 'Hot' || product.status === 'Warm'
                        return (
                          <div
                            key={product.name}
                            className="grid grid-cols-1 md:grid-cols-[minmax(120px,1fr)_130px_80px_88px_80px] gap-2 items-center p-2 rounded hover:bg-neutral-50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Checkbox
                                id={`create-sale-product-${index}`}
                                checked
                                disabled
                                className="size-5 shrink-0 border-2 border-neutral-500 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white shadow-sm opacity-100"
                              />
                              <Label htmlFor={`create-sale-product-${index}`} className="font-medium text-neutral-900 leading-tight">
                                {product.name}
                              </Label>
                            </div>
                            <Select
                              value={product.status || undefined}
                              onValueChange={(value) => handleProductStatusChange(index, value as LeadProductStatus)}
                            >
                              <SelectTrigger className="h-9 text-xs bg-white text-neutral-900 border-neutral-300">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_PRODUCT_STATUSES.map((status) => (
                                  <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="text"
                              inputMode="numeric"
                              disabled={!isHotOrWarm}
                              className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center"
                              placeholder="—"
                              value={product.strength}
                              onChange={(e) => handleProductStrengthChange(index, e.target.value)}
                            />
                            <Input
                              type="text"
                              inputMode="decimal"
                              disabled={!isHotOrWarm}
                              className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center"
                              placeholder="₹"
                              value={product.unit_price}
                              onChange={(e) => handleProductUnitPriceChange(index, e.target.value)}
                            />
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                disabled={!isHotOrWarm}
                                className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center flex-1"
                                placeholder="—"
                                value={product.status === 'Not Interested' ? '0' : product.chance}
                                onChange={(e) => handleProductChanceChange(index, e.target.value)}
                              />
                              <span className="text-xs text-neutral-500 shrink-0">%</span>
                            </div>
                            {product.status === 'Not Interested' && (
                              <div className="md:col-span-5">
                                <Label className="text-xs text-neutral-600">
                                  Reason not interested * ({product.name})
                                </Label>
                                <Input
                                  className="mt-1 h-9 text-xs bg-white text-neutral-900 border-neutral-300"
                                  placeholder="Why is the school not interested?"
                                  value={product.not_interested_reason}
                                  onChange={(e) => handleNotInterestedReasonChange(index, e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Choose a status for each product. Strength, Unit Price, and Chance % are required only for Hot and Warm.
                Hot is 80% to 100%. Warm is 20% or more. Not Interested is 0% and needs a reason.
              </p>
              {fieldErrors.products && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.products}</p>
              )}
            </div>
          )}

          <div>
            <Label>Deal Status</Label>
            <Select value={form.lead_status} onValueChange={(v) => setForm((f) => ({ ...f, lead_status: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved">Saved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone *</Label>
            {zones.length > 0 ? (
              <Select
                value={form.zone || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, zone: v, cluster: '' }))}
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z._id} value={z.name}>{z.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input className="bg-white text-neutral-900" name="zone" value={form.zone} onChange={onChange} />
            )}
          </div>
          <div>
            <Label>Cluster *</Label>
            {clusters.length > 0 ? (
              <Select
                value={form.cluster || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, cluster: v }))}
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input className="bg-white text-neutral-900" name="cluster" value={form.cluster} onChange={onChange} placeholder="Cluster in this zone" />
            )}
          </div>
          <div>
            <Label>No. of Branches *</Label>
            <Input className="bg-white text-neutral-900" type="number" name="branches" value={form.branches} onChange={onChange} required />
          </div>
          <div>
            <Label>Assign to (BDE) *</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))} disabled={loadingEmployees} required>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder={loadingEmployees ? "Loading employees..." : employees.length === 0 ? "No employees found" : "Select executive *"} />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-neutral-500">No employees available</div>
                ) : (
                  employees.map((e) => (
                    <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {employees.length === 0 && !loadingEmployees && (
              <p className="text-xs text-red-600 mt-1">Create employees first in Users / Employees → New Employee</p>
            )}
          </div>
          <div>
            <Label>School strength (students) *</Label>
            <Input className="bg-white text-neutral-900" type="number" name="strength" value={form.strength} onChange={onChange} required />
          </div>
          <div>
            <Label>Follow-up date *</Label>
            <Input
              type="date"
              className={`bg-white text-neutral-900 ${fieldErrors.follow_up_date ? 'border-red-500' : ''}`}
              name="follow_up_date"
              value={form.follow_up_date || ''}
              onChange={(e) => {
                const dateValue = e.target.value
                setForm((f) => ({ ...f, follow_up_date: dateValue }))
                if (fieldErrors.follow_up_date) {
                  clearFieldError('follow_up_date')
                }
              }}
              required
            />
            {fieldErrors.follow_up_date && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.follow_up_date}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <Label>Remarks *</Label>
            <Textarea className="bg-white text-neutral-900" name="remarks" value={form.remarks} onChange={onChange} required />
          </div>
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating Deal...' : 'Create Deal'}</Button>
            <p className="text-xs text-neutral-600 mt-2">
              Creating a Deal will automatically generate a DC entry. You can then submit PO from the "My DCs" page.
            </p>
          </div>
        </form>
      </Card>
      
      <ChatbotWidget 
        apiUrl="http://localhost:3000/api/chat/message"
        tenantId={tenantId}
        position="bottom-right"
        onFormData={handleChatbotFormData}
      />
    </div>
  )
}
