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
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useProducts } from '@/hooks/useProducts'
import { lookupPincode } from '@/lib/pincode'
import { sanitizePhoneInput, validateIndianMobile } from '@/lib/phone'
import { normalizeIntegerInput } from '@/lib/numericInput'
import { toFollowUpDatePayload } from '@/lib/followUpDate'
import { isBeforeToday } from '@/lib/todayDate'

const LEAD_STATUS_OPTIONS = ['Hot', 'Warm', 'Cold'] as const

type ProductSelection = {
  name: string
  checked: boolean
  term: string
  status: 'Hot' | 'Warm' | 'Not Interested' | 'Management Not Met' | 'Visit Again'
  /** Stored as string so empty fields do not show a stuck "0". */
  strength: string
  /** Manual unit price (same as Create Sale Add Products) — product master has no default price. */
  unit_price: string
  chance: string
}

export default function NewSchoolPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProducts, loading: productsLoading } = useProducts()
  
  const [form, setForm] = useState({
    school_type: 'New',
    school_name: '',
    school_code: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    decision_maker_name: '',
    decision_maker_mobile: '',
    location: '',
    city: '',
    address: '',
    pincode: '',
    state: '',
    region: '',
    area: '',
    lead_status: 'Warm',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
    cluster_code: '',
  })
  
  // Product selections - checkboxes for interest + per-product status/term/strength
  const [products, setProducts] = useState<ProductSelection[]>([])
  
  // Initialize products when availableProducts are loaded
  useEffect(() => {
    if (availableProducts.length > 0 && products.length === 0) {
      setProducts(
        availableProducts.map((p) => ({
          name: p,
          checked: false,
          term: 'Term 1',
          status: 'Warm',
          strength: '',
          unit_price: '',
          chance: '',
        })),
      )
    }
  }, [availableProducts])

  // Auto-fill zone from employee's assigned zone
  useEffect(() => {
    const loadUserZone = async () => {
      if (currentUser?._id) {
        try {
          const userProfile = await apiRequest<{ assignedCity?: string; zone?: string }>(`/auth/me`)
          const employeeZone = userProfile.assignedCity || userProfile.zone || ''
          if (employeeZone) {
            setForm((f) => {
              // Only set if zone is not already set
              if (!f.zone) {
                return { ...f, zone: employeeZone }
              }
              return f
            })
          }
        } catch (err) {
          // Silently fail - zone will remain empty if fetch fails
          console.error('Failed to load user zone:', err)
        }
      }
    }
    loadUserZone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?._id])
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [pincodeError, setPincodeError] = useState<string | null>(null)
  const [areas, setAreas] = useState<Array<{ name: string; district: string; block?: string; branchType?: string }>>([])
  const [zones, setZones] = useState<string[]>([])

  // Load available zones for editable Zone select
  useEffect(() => {
    const loadZones = async () => {
      try {
        const data = await apiRequest<Array<{ name?: string }>>('/zones')
        const names = (Array.isArray(data) ? data : [])
          .map((z) => (z?.name || '').trim())
          .filter(Boolean)
        setZones(Array.from(new Set(names)))
      } catch (err) {
        console.error('Failed to load zones:', err)
        setZones([])
      }
    }
    loadZones()
  }, [])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    setForm((f) => ({ ...f, [name]: sanitizePhoneInput(e.target.value) }))
  }

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((f) => ({ ...f, pincode }))
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

  const handleProductCheck = (index: number, checked: boolean) => {
    const updated = [...products]
    updated[index].checked = checked
    setProducts(updated)
  }

  const handleProductTermChange = (index: number, term: string) => {
    const updated = [...products]
    updated[index].term = term
    setProducts(updated)
  }

  const handleProductStatusChange = (
    index: number,
    status: ProductSelection['status'],
  ) => {
    const updated = [...products]
    updated[index].status = status

    // For non Hot/Warm statuses, strength and chance should be 0
    if (status !== 'Hot' && status !== 'Warm') {
      updated[index].strength = ''
      updated[index].chance = ''
    }

    setProducts(updated)
  }

  const handleProductStrengthChange = (index: number, raw: string) => {
    const updated = [...products]
    updated[index].strength = normalizeIntegerInput(raw)
    setProducts(updated)
  }

  const handleProductUnitPriceChange = (index: number, raw: string) => {
    // Allow decimals for unit price (Create Sale style), strip invalid chars
    let value = String(raw || '').replace(/[^\d.]/g, '')
    const parts = value.split('.')
    if (parts.length > 2) {
      value = `${parts[0]}.${parts.slice(1).join('')}`
    }
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    // Validate required fields
    if (!form.school_code || !form.school_code.trim()) {
      setError('School Code is required')
      setSubmitting(false)
      return
    }
    if (!form.decision_maker_name || !form.decision_maker_name.trim()) {
      setError('Decision Maker Name is required')
      setSubmitting(false)
      return
    }
    if (!form.email || !form.email.trim()) {
      setError('Email is required')
      setSubmitting(false)
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      setError('Please enter a valid email address')
      setSubmitting(false)
      return
    }
    const contactMobileCheck = validateIndianMobile(form.contact_mobile, 'Contact mobile')
    if (!contactMobileCheck.ok) {
      setError(contactMobileCheck.message)
      setSubmitting(false)
      return
    }
    const decisionMobileCheck = validateIndianMobile(
      form.decision_maker_mobile,
      'Decision Maker Mobile Number'
    )
    if (!decisionMobileCheck.ok) {
      setError(decisionMobileCheck.message)
      setSubmitting(false)
      return
    }
    if (!form.area || !form.area.trim()) {
      setError('Area is required. Please enter pincode and select an area.')
      setSubmitting(false)
      return
    }
    if (!form.average_fee || !form.average_fee.trim()) {
      setError('Average School Fee is required')
      setSubmitting(false)
      return
    }
    if (!form.branches || !form.branches.trim()) {
      setError('No. of Branches is required')
      setSubmitting(false)
      return
    }
    if (!form.strength || !form.strength.trim()) {
      setError('School Strength is required')
      setSubmitting(false)
      return
    }
    if (!form.remarks || !form.remarks.trim()) {
      setError('Remarks is required')
      setSubmitting(false)
      return
    }
    if (!form.zone || !form.zone.trim()) {
      setError('Zone is required')
      setSubmitting(false)
      return
    }
    if (!form.follow_up_date || !form.follow_up_date.trim()) {
      setError('Follow-up date is required')
      setSubmitting(false)
      return
    }
    if (isBeforeToday(form.follow_up_date)) {
      setError('Follow-up date cannot be in the past')
      setSubmitting(false)
      return
    }
    
    try {
      // Build products array from checked products - include term and per-product status/strength/chance
      const selectedProducts = products.filter((p) => p.checked)

      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }

      // Validate per-product rules
      for (const p of selectedProducts) {
        const strengthNum = Number(p.strength)
        const chanceNum = p.chance === '' ? 0 : Number(p.chance)
        const unitPriceNum = Number(p.unit_price)

        // Unit price required for every selected product (same rule as Create Sale / dc-orders create)
        if (
          !String(p.unit_price || '').trim() ||
          !Number.isFinite(unitPriceNum) ||
          unitPriceNum <= 0
        ) {
          throw new Error(
            `Please enter a Unit Price greater than 0 for product "${p.name}".`,
          )
        }

        // Strength is required for Hot/Warm
        if ((p.status === 'Hot' || p.status === 'Warm') && (!p.strength.trim() || strengthNum <= 0)) {
          throw new Error(
            `Please enter strength for product "${p.name}" when status is ${p.status}.`,
          )
        }

        // Chance rules
        if (p.status === 'Hot') {
          if (chanceNum < 80) {
            throw new Error(
              `Chance % for product "${p.name}" must be at least 80% when status is Hot.`,
            )
          }
        } else if (p.status === 'Warm') {
          if (chanceNum < 20) {
            throw new Error(
              `Chance % for product "${p.name}" must be at least 20% when status is Warm.`,
            )
          }
        }
      }

      const productsPayload = selectedProducts.map((p) => {
        const strengthNum = Number(p.strength) || 0
        const chanceNum =
          p.status === 'Hot' || p.status === 'Warm' ? Number(p.chance) || 0 : 0
        const unitPriceNum = Number(p.unit_price)
        return {
          product_name: p.name,
          quantity: strengthNum > 0 ? strengthNum : 1,
          unit_price: unitPriceNum,
          term: p.term || 'Term 1',
          status: p.status,
          strength: strengthNum,
          chance: chanceNum,
        }
      })
      
      const payload: any = {
        school_name: form.school_name,
        school_code: form.school_code.trim(),
        school_type: form.school_type || 'New', // Use selected school type (New or Existing)
        contact_person: form.contact_person,
        contact_mobile: contactMobileCheck.digits,
        contact_person2: form.decision_maker_name || undefined,
        contact_mobile2: decisionMobileCheck.digits,
        location: form.location || undefined,
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        zone: form.zone || undefined,
        lead_status: form.lead_status || 'Warm',
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength && form.strength.trim() ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: productsPayload,
        follow_up_date: toFollowUpDatePayload(form.follow_up_date), // Date only — no default time
        assigned_to: currentUser?._id, // Auto-assign to current employee
        cluster_code: form.cluster_code || undefined,
      }
      
      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }
      
      await apiRequest('/dc-orders/create', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('New school lead created successfully!')
      router.push('/dashboard/leads/followup')
    } catch (err: any) {
      const raw = err?.message || 'Failed to create lead'
      const message = /school code already exists/i.test(raw)
        ? 'This school already exists. Go to Renewal Leads.'
        : raw
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads/add">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add New School</h1>
          <p className="text-sm text-neutral-600 mt-1">Create a lead for a new school</p>
        </div>
      </div>

      <Card className="p-4 md:p-6 bg-neutral-50 border border-neutral-200 text-neutral-900">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>School name *</Label>
            <Input className="bg-white text-neutral-900" name="school_name" value={form.school_name} onChange={onChange} required />
          </div>
          <div>
            <Label>School code *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="school_code"
              value={form.school_code}
              onChange={onChange}
              placeholder="Enter school code"
              required
            />
          </div>
          <div>
            <Label>School Type</Label>
            <Select value={form.school_type} onValueChange={(v) => setForm((f) => ({ ...f, school_type: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Existing">Existing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact person *</Label>
            <Input className="bg-white text-neutral-900" name="contact_person" value={form.contact_person} onChange={onChange} required />
          </div>
          <div>
            <Label>Contact mobile *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="contact_mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength={15}
              value={form.contact_mobile}
              onChange={onPhoneChange}
              required
            />
            <p className="text-xs text-neutral-500 mt-1">Digits only (10–15 digits)</p>
          </div>
          <div>
            <Label>Email *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} required />
          </div>
          <div>
            <Label>Decision Maker Name *</Label>
            <Input className="bg-white text-neutral-900" name="decision_maker_name" value={form.decision_maker_name} onChange={onChange} required />
          </div>
          <div>
            <Label>Decision Maker Mobile Number *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="decision_maker_mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              maxLength={15}
              value={form.decision_maker_mobile}
              onChange={onPhoneChange}
              required
            />
            <p className="text-xs text-neutral-500 mt-1">Digits only (10–15 digits)</p>
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
            <Label>Landmark</Label>
            <Input className="bg-white text-neutral-900" name="location" value={form.location} onChange={onChange} />
          </div>
          <div>
            <Label>Area *</Label>
            <Select 
              value={form.area || undefined} 
              onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
              disabled={areas.length === 0}
              required
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder={areas.length === 0 ? "Enter pincode first" : "Select exact area"} />
              </SelectTrigger>
              <SelectContent>
                {areas
                  .filter(area => area.name && area.name.trim() !== '')
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
            <p className="text-xs text-neutral-500 mt-1">
              Select the exact post office area for this location
            </p>
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" name="address" value={form.address} onChange={onChange} />
          </div>
          
          {/* Average School Fee */}
          <div>
            <Label>Average School Fee *</Label>
            <Input 
              className="bg-white text-neutral-900" 
              type="number" 
              name="average_fee" 
              value={form.average_fee} 
              onChange={onChange} 
              placeholder="Enter average school fee"
              required
            />
          </div>
          
          {/* No. of Branches */}
          <div>
            <Label>No. of Branches *</Label>
            <Input 
              className="bg-white text-neutral-900" 
              type="number" 
              name="branches" 
              value={form.branches} 
              onChange={onChange} 
              required
            />
          </div>
          
          {/* School Strength */}
          <div>
            <Label>School Strength (students) *</Label>
            <Input 
              className="bg-white text-neutral-900" 
              type="number" 
              name="strength" 
              value={form.strength} 
              onChange={onChange} 
              required
            />
          </div>
          
          {/* Remarks */}
          <div className="md:col-span-2">
            <Label>Remarks *</Label>
            <Textarea 
              className="bg-white text-neutral-900" 
              name="remarks" 
              value={form.remarks} 
              onChange={onChange} 
              required
            />
          </div>
          
          {/* Products Interested Section */}
          <div className="md:col-span-2">
            <Label>Products Interested *</Label>
            <div className="mt-2 p-4 bg-white rounded border border-neutral-200">
              {productsLoading ? (
                <p className="text-sm text-neutral-500">Loading products…</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-neutral-500">No products available.</p>
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
                          className="grid grid-cols-1 md:grid-cols-[minmax(120px,1fr)_130px_80px_88px_80px] gap-2 items-center p-2 rounded hover:bg-neutral-50 border border-transparent hover:border-neutral-100"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Checkbox
                              id={`product-${index}`}
                              checked={product.checked}
                              onCheckedChange={(checked) =>
                                handleProductCheck(index, checked as boolean)
                              }
                              className="size-5 shrink-0 border-2 border-neutral-500 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white shadow-sm"
                            />
                            <Label
                              htmlFor={`product-${index}`}
                              className="font-medium cursor-pointer text-neutral-900 leading-tight"
                            >
                              {product.name}
                            </Label>
                          </div>
                          <div className="flex flex-col gap-0.5 md:contents">
                            <span className="text-xs text-neutral-500 md:hidden">Status</span>
                            <Select
                              value={product.status}
                              onValueChange={(value) =>
                                handleProductStatusChange(
                                  index,
                                  value as ProductSelection['status'],
                                )
                              }
                              disabled={!product.checked}
                            >
                              <SelectTrigger className="h-9 text-xs bg-white text-neutral-900 border-neutral-300">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Hot">Hot</SelectItem>
                                <SelectItem value="Warm">Warm</SelectItem>
                                <SelectItem value="Not Interested">Not Interested</SelectItem>
                                <SelectItem value="Management Not Met">
                                  Management Not Met
                                </SelectItem>
                                <SelectItem value="Visit Again">Visit Again</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-0.5 md:contents">
                            <span className="text-xs text-neutral-500 md:hidden">Strength</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              disabled={!product.checked || !isHotOrWarm}
                              className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center"
                              placeholder="—"
                              value={product.strength}
                              onChange={(e) => handleProductStrengthChange(index, e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5 md:contents">
                            <span className="text-xs text-neutral-500 md:hidden">Unit Price</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              disabled={!product.checked}
                              className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center"
                              placeholder="₹"
                              value={product.unit_price}
                              onChange={(e) => handleProductUnitPriceChange(index, e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-0.5 md:contents">
                            <span className="text-xs text-neutral-500 md:hidden">Chance %</span>
                            <div className="flex items-center gap-1">
                              <Input
                                type="text"
                                inputMode="numeric"
                                disabled={!product.checked || !isHotOrWarm}
                                className="h-9 text-xs bg-white text-neutral-900 border-neutral-300 text-center flex-1"
                                placeholder="—"
                                value={product.chance}
                                onChange={(e) => handleProductChanceChange(index, e.target.value)}
                              />
                              <span className="text-xs text-neutral-500 shrink-0">%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Select products, then set Status, Strength, Unit Price, and Chance % for each. Term is set after the lead is closed.
              Unit Price is required for every selected product. Strength is required when status is Hot or Warm; other statuses will always
              have 0 strength and 0% chance.
            </p>
          </div>

          <div>
            <Label>Lead status *</Label>
            <Select
              value={form.lead_status}
              onValueChange={(v) => setForm((f) => ({ ...f, lead_status: v }))}
              required
            >
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select lead status" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 mt-1">
              Pipeline status (Hot / Warm / Cold). Product rows below can have finer status per SKU.
            </p>
          </div>
          <div>
            <Label>Zone *</Label>
            {zones.length > 0 ? (
              <Select
                value={form.zone || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, zone: v }))}
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {(form.zone && !zones.includes(form.zone)
                    ? [form.zone, ...zones]
                    : zones
                  ).map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="bg-white text-neutral-900"
                name="zone"
                value={form.zone}
                onChange={onChange}
                placeholder="Enter zone"
                required
              />
            )}
          </div>
          <div>
            <Label>Cluster Code</Label>
            <Input
              className="bg-white text-neutral-900"
              name="cluster_code"
              value={form.cluster_code}
              onChange={onChange}
              placeholder="Enter cluster code"
            />
          </div>
          <div>
            <Label>Follow-up date *</Label>
            <Input 
              type="date"
              className="bg-white text-neutral-900" 
              name="follow_up_date" 
              value={form.follow_up_date || ''} 
              onChange={(e) => {
                const dateValue = e.target.value
                setForm((f) => ({ ...f, follow_up_date: dateValue }))
              }}
              required
            />
          </div>
          {error && (
            <div className="md:col-span-2 text-red-600 text-sm">
              {error.includes('Renewal Leads') ? (
                <>
                  This school already exists.{' '}
                  <Link href="/dashboard/leads/renewal" className="underline font-medium">
                    Go to Renewal Leads
                  </Link>
                  .
                </>
              ) : (
                error
              )}
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create New School Lead'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

