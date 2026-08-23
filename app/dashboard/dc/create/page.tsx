'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  validateSchoolCode,
  validateSchoolName,
} from '@/lib/saleFormValidation'

/** Create Sale School Type options (Super Admin / Coordinator). */
const CREATE_SALE_SCHOOL_TYPES = ['New', 'Existing'] as const
type CreateSaleSchoolType = (typeof CREATE_SALE_SCHOOL_TYPES)[number]

type ProductSelection = {
  name: string
  checked: boolean
  price: number
  quantity: number
  strength: number
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
    school_code: '',
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
    branches: '',
    strength: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  })

  const [areas, setAreas] = useState<PostOfficeArea[]>([])
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [pincodeError, setPincodeError] = useState<string | null>(null)
  const [schoolCodeError, setSchoolCodeError] = useState<string | null>(null)
  const [checkingSchoolCode, setCheckingSchoolCode] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    school_name?: string
    school_code?: string
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
          checked: false,
          price: 0,
          quantity: 1,
          strength: 0,
        }))
      )
    }
  }, [availableProducts, isSuperAdmin, products.length])

  const handleProductCheck = (index: number, checked: boolean) => {
    const updated = [...products]
    updated[index].checked = checked
    setProducts(updated)
    if (checked) {
      setFieldErrors((prev) => {
        if (!prev.products) return prev
        const next = { ...prev }
        delete next.products
        return next
      })
    }
  }

  const handleProductFieldChange = (
    index: number,
    field: 'price' | 'quantity' | 'strength',
    value: number
  ) => {
    const updated = [...products]
    updated[index][field] = value
    setProducts(updated)
  }
  
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
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
      nextValue = digits.slice(0, 10)
      if (hasNonDigits || digits.length > 10) {
        setFieldErrors((prev) => ({
          ...prev,
          [name]: 'Enter a valid 10-digit mobile number.',
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
    if (name === 'school_code' && schoolCodeError) {
      setSchoolCodeError(null)
    }
  }

  const checkSchoolCodeUnique = async (rawCode: string): Promise<boolean> => {
    const format = validateSchoolCode(rawCode)
    if (!format.ok) {
      setSchoolCodeError(format.message)
      setFieldErrors((prev) => ({ ...prev, school_code: format.message }))
      return false
    }
    const code = format.value
    setCheckingSchoolCode(true)
    try {
      const schools = await apiRequest<Array<{ schoolCode?: string }>>('/schools')
      const list = Array.isArray(schools) ? schools : []
      const exists = list.some(
        (s) => (s.schoolCode || '').trim().toLowerCase() === code.toLowerCase()
      )
      if (exists) {
        setSchoolCodeError('School Code already exists. Please enter a unique School Code.')
        setFieldErrors((prev) => ({
          ...prev,
          school_code: 'School Code already exists. Please enter a unique School Code.',
        }))
        return false
      }
      setSchoolCodeError(null)
      clearFieldError('school_code')
      return true
    } catch (err) {
      console.error('School code uniqueness check failed:', err)
      // Backend create still enforces uniqueness; allow submit to proceed to server check
      setSchoolCodeError(null)
      return true
    } finally {
      setCheckingSchoolCode(false)
    }
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
    if (formData.school_code) setForm(prev => ({ ...prev, school_code: formData.school_code }))
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

      const schoolCodeCheck = validateSchoolCode(form.school_code)
      if (!schoolCodeCheck.ok) nextFieldErrors.school_code = schoolCodeCheck.message

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
        ? products
            .filter((p) => p.checked)
            .map((p) => ({
              product_name: p.name,
              quantity: p.quantity || 1,
              unit_price: p.price || 0,
              strength: p.strength || 0,
            }))
        : []

      if (isSuperAdmin && selectedProducts.length === 0) {
        nextFieldErrors.products = 'Please select at least one product.'
      }

      setFieldErrors(nextFieldErrors)
      if (nextFieldErrors.school_code) {
        setSchoolCodeError(nextFieldErrors.school_code)
      }
      if (Object.keys(nextFieldErrors).length > 0) {
        const firstMessage = Object.values(nextFieldErrors)[0]
        throw new Error(firstMessage || 'Please fix the highlighted fields.')
      }
      if (
        !schoolNameCheck.ok ||
        !schoolCodeCheck.ok ||
        !contactPersonCheck.ok ||
        !contactMobileCheck.ok ||
        !contactPerson2Check.ok ||
        !contactMobile2Check.ok
      ) {
        throw new Error('Please fix the highlighted fields.')
      }

      const schoolCode = schoolCodeCheck.value

      if (!form.email.trim()) {
        throw new Error('Email is required')
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) {
        throw new Error('Please enter a valid email address')
      }

      const schoolCodeOk = await checkSchoolCodeUnique(schoolCode)
      if (!schoolCodeOk) {
        throw new Error('School Code already exists. Please enter a unique School Code.')
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
        school_code: schoolCode,
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
        status: form.lead_status || 'pending',
        branches: Number(form.branches),
        strength: Number(form.strength),
        remarks: form.remarks.trim(),
        email: form.email.trim(),
        products: selectedProducts,
        estimated_delivery_date: followUpIso,
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
            <Label>School Code *</Label>
            <Input
              className={`bg-white text-neutral-900 ${schoolCodeError || fieldErrors.school_code ? 'border-red-500' : ''}`}
              name="school_code"
              value={form.school_code}
              onChange={onChange}
              onBlur={() => {
                if (form.school_code.trim()) {
                  void checkSchoolCodeUnique(form.school_code)
                }
              }}
              placeholder="Enter unique school code"
              required
            />
            {checkingSchoolCode && (
              <p className="text-xs text-blue-600 mt-1">Checking school code...</p>
            )}
            {(schoolCodeError || fieldErrors.school_code) && !checkingSchoolCode && (
              <p className="text-xs text-red-600 mt-1">{schoolCodeError || fieldErrors.school_code}</p>
            )}
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
              maxLength={10}
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
              maxLength={10}
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
              <Label>Products *</Label>
              <div
                className={`space-y-3 p-4 bg-white rounded border ${
                  fieldErrors.products ? 'border-red-500' : 'border-neutral-200'
                }`}
              >
                {products.length === 0 ? (
                  <p className="text-sm text-neutral-500">Loading products...</p>
                ) : (
                  products.map((product, index) => (
                    <div
                      key={product.name}
                      className="flex items-center gap-4 p-2 border rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-2 min-w-[200px]">
                        <Checkbox
                          id={`create-sale-product-${index}`}
                          checked={product.checked}
                          onCheckedChange={(checked) =>
                            handleProductCheck(index, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`create-sale-product-${index}`}
                          className="font-medium cursor-pointer"
                        >
                          {product.name}
                        </Label>
                      </div>

                      {product.checked && (
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`create-sale-product-price-${index}`} className="text-xs">
                              Price (₹)
                            </Label>
                            <Input
                              id={`create-sale-product-price-${index}`}
                              type="number"
                              className="bg-white text-neutral-900 h-8"
                              value={product.price || ''}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  index,
                                  'price',
                                  Number(e.target.value) || 0
                                )
                              }
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`create-sale-product-qty-${index}`} className="text-xs">
                              Quantity
                            </Label>
                            <Input
                              id={`create-sale-product-qty-${index}`}
                              type="number"
                              className="bg-white text-neutral-900 h-8"
                              value={product.quantity || ''}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  index,
                                  'quantity',
                                  Number(e.target.value) || 1
                                )
                              }
                              placeholder="1"
                              min="1"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor={`create-sale-product-strength-${index}`}
                              className="text-xs"
                            >
                              Strength
                            </Label>
                            <Input
                              id={`create-sale-product-strength-${index}`}
                              type="number"
                              className="bg-white text-neutral-900 h-8"
                              value={product.strength || ''}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  index,
                                  'strength',
                                  Number(e.target.value) || 0
                                )
                              }
                              placeholder="0"
                              min="0"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Check products to enable Price, Quantity, and Strength fields for each product.
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
            <Label>Zone</Label>
            <Input className="bg-white text-neutral-900" name="zone" value={form.zone} onChange={onChange} />
          </div>
          <div>
            <Label>No. of Branches *</Label>
            <Input className="bg-white text-neutral-900" type="number" name="branches" value={form.branches} onChange={onChange} required />
          </div>
          <div>
            <Label>Assign to (Executive) *</Label>
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
