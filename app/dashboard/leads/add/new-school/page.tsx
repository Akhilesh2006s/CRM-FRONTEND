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
import { geocodeSchoolLocation } from '@/lib/geocode'

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
  not_interested_reason: string
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
    contact_designation: '',
    email: '',
    decision_maker_name: '',
    decision_maker_mobile: '',
    financial_contact_designation: '',
    location: '',
    city: '',
    address: '',
    pincode: '',
    state: '',
    region: '',
    area: '',
    mandal: '',
    cluster: '',
    latitude: '',
    longitude: '',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
    cluster_code: '',
  })
  const isSuperAdmin = currentUser?.role === 'Super Admin'
  const [clustersForZone, setClustersForZone] = useState<string[]>([])
  const [geocoding, setGeocoding] = useState(false)
  
  // Product selections - checkboxes for interest + per-product status/term/strength
  const [products, setProducts] = useState<ProductSelection[]>([])
  
  // Initialize products — all pre-selected (cannot deselect)
  useEffect(() => {
    if (availableProducts.length > 0 && products.length === 0) {
      setProducts(
        availableProducts.map((p) => ({
          name: p,
          checked: true,
          term: 'Term 1',
          status: 'Warm' as const,
          strength: '',
          unit_price: '',
          chance: '',
          not_interested_reason: '',
        })),
      )
    }
  }, [availableProducts])

  // Auto-fill zone + cluster from employee
  useEffect(() => {
    const loadUserZone = async () => {
      if (currentUser?._id) {
        try {
          const userProfile = await apiRequest<{
            assignedCity?: string
            zone?: string
            cluster?: string
          }>(`/auth/me`)
          const employeeZone = userProfile.assignedCity || userProfile.zone || ''
          const employeeCluster = userProfile.cluster || ''
          if (employeeZone || employeeCluster) {
            setForm((f) => ({
              ...f,
              zone: f.zone || employeeZone,
              cluster: f.cluster || employeeCluster,
              cluster_code: f.cluster_code || employeeCluster,
            }))
          }
        } catch (err) {
          console.error('Failed to load user zone:', err)
        }
      }
    }
    loadUserZone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?._id])

  // Load clusters when zone changes
  useEffect(() => {
    const loadClusters = async () => {
      if (!form.zone) {
        setClustersForZone([])
        return
      }
      try {
        const zones = await apiRequest<{ _id: string; name: string }[]>('/zones')
        const match = (Array.isArray(zones) ? zones : []).find(
          (z) => z.name === form.zone
        )
        if (!match?._id) {
          setClustersForZone([])
          return
        }
        const clusters = await apiRequest<{ name: string }[]>(
          `/zones/${match._id}/clusters`
        )
        setClustersForZone(
          (Array.isArray(clusters) ? clusters : []).map((c) => c.name).filter(Boolean)
        )
      } catch {
        setClustersForZone([])
      }
    }
    loadClusters()
  }, [form.zone])

  // Auto geocode when location pieces are enough
  useEffect(() => {
    const run = async () => {
      if (!form.area && !form.location && !form.city) return
      if (!form.state && !form.pincode) return
      setGeocoding(true)
      const coords = await geocodeSchoolLocation({
        location: form.location,
        area: form.area,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
      })
      setGeocoding(false)
      if (coords) {
        setForm((f) => ({
          ...f,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }))
      }
    }
    const t = setTimeout(run, 800)
    return () => clearTimeout(t)
  }, [form.location, form.area, form.city, form.state, form.pincode])
  
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

  const handleProductCheck = (_index: number, _checked: boolean) => {
    // Products cannot be deselected (Module 2)
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

    if (status !== 'Hot' && status !== 'Warm') {
      updated[index].strength = ''
      updated[index].chance = ''
    }
    if (status !== 'Not Interested') {
      updated[index].not_interested_reason = ''
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

  const handleNotInterestedReasonChange = (index: number, reason: string) => {
    const updated = [...products]
    updated[index].not_interested_reason = reason
    setProducts(updated)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    // Validate required fields
    if (!form.contact_person?.trim()) {
      setError('School contact person name is required')
      setSubmitting(false)
      return
    }
    if (!form.contact_designation?.trim()) {
      setError('School contact designation is required')
      setSubmitting(false)
      return
    }
    if (!form.decision_maker_name || !form.decision_maker_name.trim()) {
      setError('Financial contact person name is required')
      setSubmitting(false)
      return
    }
    if (!form.financial_contact_designation?.trim()) {
      setError('Financial contact designation is required')
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
    if (!form.cluster || !form.cluster.trim()) {
      setError('Cluster is required')
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
      // All products are mandatory / pre-selected
      const selectedProducts = products.filter((p) => p.checked)

      if (selectedProducts.length === 0) {
        throw new Error('All products must be included. Please wait for products to load.')
      }

      // Validate per-product rules
      for (const p of selectedProducts) {
        const strengthNum = Number(p.strength)
        const chanceNum = p.chance === '' ? 0 : Number(p.chance)
        const unitPriceNum = Number(p.unit_price)

        if (p.status === 'Not Interested') {
          if (!String(p.not_interested_reason || '').trim()) {
            throw new Error(
              `Please enter a reason why the school is not interested in "${p.name}".`,
            )
          }
          continue
        }

        if (
          !String(p.unit_price || '').trim() ||
          !Number.isFinite(unitPriceNum) ||
          unitPriceNum <= 0
        ) {
          throw new Error(
            `Please enter a Unit Price greater than 0 for product "${p.name}".`,
          )
        }

        if ((p.status === 'Hot' || p.status === 'Warm') && (!p.strength.trim() || strengthNum <= 0)) {
          throw new Error(
            `Please enter strength for product "${p.name}" when status is ${p.status}.`,
          )
        }

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
        const unitPriceNum = Number(p.unit_price) || 0
        return {
          product_name: p.name,
          quantity: strengthNum > 0 ? strengthNum : 1,
          unit_price: unitPriceNum,
          term: p.term || 'Term 1',
          status: p.status,
          strength: strengthNum,
          chance: chanceNum,
          not_interested_reason:
            p.status === 'Not Interested' ? p.not_interested_reason.trim() : '',
        }
      })
      
      const payload: any = {
        school_name: form.school_name,
        // Omit school_code so backend auto-generates from state + district
        school_type: form.school_type || 'New',
        contact_person: form.contact_person,
        contact_mobile: contactMobileCheck.digits,
        contact_designation: form.contact_designation.trim(),
        contact_person2: form.decision_maker_name || undefined,
        contact_mobile2: decisionMobileCheck.digits,
        financial_contact_designation: form.financial_contact_designation.trim(),
        decision_maker: form.decision_maker_name || undefined,
        location: form.location || undefined,
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        mandal: form.mandal || undefined,
        cluster: form.cluster || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        zone: form.zone || undefined,
        branches: form.branches ? Number(form.branches) : undefined,
        no_of_branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength && form.strength.trim() ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        avg_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: productsPayload,
        follow_up_date: toFollowUpDatePayload(form.follow_up_date),
        assigned_to: currentUser?._id,
        cluster_code: form.cluster || form.cluster_code || undefined,
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
            <Label>School code</Label>
            <Input
              className="bg-neutral-100 text-neutral-700"
              value={form.school_code || 'Auto-generated from state + district on save'}
              readOnly
              disabled
            />
          </div>
          <div>
            <Label>School contact person *</Label>
            <Input className="bg-white text-neutral-900" name="contact_person" value={form.contact_person} onChange={onChange} required />
          </div>
          <div>
            <Label>School contact mobile *</Label>
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
          </div>
          <div>
            <Label>School contact designation *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="contact_designation"
              value={form.contact_designation}
              onChange={onChange}
              placeholder="e.g. Principal"
              required
            />
          </div>
          <div>
            <Label>Email *</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} required />
          </div>
          <div>
            <Label>Financial contact person *</Label>
            <Input className="bg-white text-neutral-900" name="decision_maker_name" value={form.decision_maker_name} onChange={onChange} required />
          </div>
          <div>
            <Label>Financial contact mobile *</Label>
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
          </div>
          <div>
            <Label>Financial contact designation *</Label>
            <Input
              className="bg-white text-neutral-900"
              name="financial_contact_designation"
              value={form.financial_contact_designation}
              onChange={onChange}
              placeholder="e.g. Accountant"
              required
            />
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
            <Label>Landmark {isSuperAdmin ? '' : '(Super Admin only)'}</Label>
            <Input
              className={`text-neutral-900 ${isSuperAdmin ? 'bg-white' : 'bg-neutral-100'}`}
              name="location"
              value={form.location}
              onChange={onChange}
              disabled={!isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
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
            <Label>Address {isSuperAdmin ? '' : '(Super Admin only)'}</Label>
            <Textarea
              className={`text-neutral-900 ${isSuperAdmin ? 'bg-white' : 'bg-neutral-100'}`}
              name="address"
              value={form.address}
              onChange={onChange}
              disabled={!isSuperAdmin}
              readOnly={!isSuperAdmin}
            />
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

          <div>
            <Label>Mandal</Label>
            <Input
              className="bg-white text-neutral-900"
              name="mandal"
              value={form.mandal}
              onChange={onChange}
              placeholder="Enter mandal"
            />
          </div>
          <div>
            <Label>Cluster *</Label>
            {clustersForZone.length > 0 ? (
              <Select
                value={form.cluster || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, cluster: v, cluster_code: v }))
                }
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clustersForZone.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="bg-white text-neutral-900"
                name="cluster"
                value={form.cluster}
                onChange={onChange}
                placeholder="Cluster (from employee zone)"
              />
            )}
          </div>
          <div>
            <Label>Latitude {geocoding ? '(locating…)' : '(auto)'}</Label>
            <Input
              className="bg-neutral-100 text-neutral-700"
              type="number"
              step="any"
              name="latitude"
              value={form.latitude}
              readOnly
              placeholder="Auto from location"
            />
          </div>
          <div>
            <Label>Longitude (auto)</Label>
            <Input
              className="bg-neutral-100 text-neutral-700"
              type="number"
              step="any"
              name="longitude"
              value={form.longitude}
              readOnly
              placeholder="Auto from location"
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
            <Label>Products * (all required — cannot deselect)</Label>
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
                              checked={true}
                              disabled
                              className="size-5 shrink-0 border-2 border-neutral-500 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white shadow-sm opacity-100"
                            />
                            <Label
                              htmlFor={`product-${index}`}
                              className="font-medium text-neutral-900 leading-tight"
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
                          {product.status === 'Not Interested' && (
                            <div className="md:col-span-5 mt-1">
                              <Label className="text-xs text-neutral-600">
                                Reason not interested * ({product.name})
                              </Label>
                              <Input
                                className="mt-1 h-9 text-xs bg-white text-neutral-900 border-neutral-300"
                                placeholder="Why is the school not interested?"
                                value={product.not_interested_reason}
                                onChange={(e) =>
                                  handleNotInterestedReasonChange(index, e.target.value)
                                }
                                required
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
              All products are required. Set Status, Strength, Unit Price, and Chance % for each. Term is set after the lead is closed.
              Unit Price is required unless status is Not Interested (then a reason is required). Strength is required when status is Hot or Warm.
            </p>
          </div>

          <div>
            <Label>Zone *</Label>
            {zones.length > 0 ? (
              <Select
                value={form.zone || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    zone: v,
                    cluster: '',
                    cluster_code: '',
                  }))
                }
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

