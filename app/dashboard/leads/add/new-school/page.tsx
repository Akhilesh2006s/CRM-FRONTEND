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

type ProductSelection = {
  name: string
  checked: boolean
  term: string
  status: 'Hot' | 'Warm' | 'Not Interested' | 'Management Not Met' | 'Visit Again'
  strength: number
  chance: number
}

export default function NewSchoolPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProducts, loading: productsLoading } = useProducts()
  
  const [form, setForm] = useState({
    school_type: 'New',
    school_name: '',
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
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
  })
  
  // Product selections - checkboxes + per-product status/term/strength
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
          strength: 0,
          chance: 0,
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
  const [areas, setAreas] = useState<Array<{ name: string; district: string; block?: string; branchType?: string }>>([])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((f) => ({ ...f, pincode }))
    
    if (pincode.length === 6) {
      setLoadingPincode(true)
      try {
        const response = await apiRequest<{
          town?: string
          district?: string
          state?: string
          region?: string
          success: boolean
          postOffices?: Array<{ Name: string; District: string; State: string; Division?: string; Region?: string; Block?: string; BranchType?: string }>
        }>(`/location/get-town?pincode=${pincode}`)
        
        if (response.success && response.town) {
          setForm((f) => ({
            ...f,
            // Don't auto-fill location (landmark) - user should enter manually
            city: response.district || '',
            state: response.state || '',
            region: response.region || '',
            // Don't auto-select area - user must select manually
          }))
          
          // Populate area dropdown with all post offices (exact areas)
          if (response.postOffices && response.postOffices.length > 0) {
            setAreas(response.postOffices.map(po => ({
              name: po.Name,
              district: po.District,
              block: po.Block,
              branchType: po.BranchType,
            })))
            // Don't auto-select - user must select manually
          } else {
            // Fallback: use town as area option
            setAreas([{ name: response.town, district: response.district || '' }])
            // Don't auto-select - user must select manually
          }
        }
      } catch (err: any) {
        console.error('Pincode lookup failed:', err)
        // Don't show error, just allow manual entry
        setAreas([])
      } finally {
        setLoadingPincode(false)
      }
    } else {
      // Clear fields if pincode is incomplete
      if (pincode.length < 6) {
        setAreas([])
        setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }))
        // Don't clear location (landmark) - user may have entered it manually
      }
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
      updated[index].strength = 0
      updated[index].chance = 0
    }

    setProducts(updated)
  }

  const handleProductStrengthChange = (index: number, value: number) => {
    const updated = [...products]
    updated[index].strength = value < 0 ? 0 : value
    setProducts(updated)
  }

  const handleProductChanceChange = (index: number, value: number) => {
    const updated = [...products]
    // Clamp between 0 and 100
    const clamped = Math.max(0, Math.min(100, value))
    updated[index].chance = clamped
    setProducts(updated)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    // Validate required fields
    if (!form.decision_maker_name || !form.decision_maker_name.trim()) {
      setError('Decision Maker Name is required')
      setSubmitting(false)
      return
    }
    if (!form.decision_maker_mobile || !form.decision_maker_mobile.trim()) {
      setError('Decision Maker Mobile Number is required')
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
    if (!form.follow_up_date || !form.follow_up_date.trim()) {
      setError('Follow-up date is required')
      setSubmitting(false)
      return
    }
    
    try {
      const parseFollowUp = (s: string) => {
        if (!s) return undefined
        // Handle date input type format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const d = new Date(s + 'T00:00:00Z')
          if (!isNaN(d.getTime())) return d.toISOString()
        }
        // Fallback for manual entry format (dd-mm-yyyy)
        const norm = s.replace(/\//g, '-').trim()
        if (/^\d{2}-\d{2}-\d{4}$/.test(norm)) {
          const [dd, mm, yyyy] = norm.split('-').map(Number)
          const d = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1))
          if (!isNaN(d.getTime())) return d.toISOString()
        }
        return undefined
      }
      
      // Build products array from checked products - include term and per-product status/strength/chance
      const selectedProducts = products.filter((p) => p.checked)

      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }

      // Validate per-product rules
      for (const p of selectedProducts) {
        // Strength is required for Hot/Warm
        if ((p.status === 'Hot' || p.status === 'Warm') && (!p.strength || p.strength <= 0)) {
          throw new Error(
            `Please enter strength for product "${p.name}" when status is ${p.status}.`,
          )
        }

        // Chance rules
        if (p.status === 'Hot') {
          if (p.chance < 80) {
            throw new Error(
              `Chance % for product "${p.name}" must be at least 80% when status is Hot.`,
            )
          }
        } else if (p.status === 'Warm') {
          if (p.chance < 20) {
            throw new Error(
              `Chance % for product "${p.name}" must be at least 20% when status is Warm.`,
            )
          }
        } else {
          // For all other statuses, chance must be 0
          p.chance = 0
        }
      }

      const productsPayload = selectedProducts.map((p) => ({
          product_name: p.name,
          quantity: 1,
          unit_price: 0,
          term: p.term || 'Term 1',
        status: p.status,
        strength: p.strength || 0,
        chance: p.chance || 0,
        }))
      
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type || 'New', // Use selected school type (New or Employee)
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.decision_maker_name || undefined,
        contact_mobile2: form.decision_maker_mobile || undefined,
        location: form.location || undefined,
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        zone: form.zone || undefined,
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength && form.strength.trim() ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: productsPayload,
        follow_up_date: parseFollowUp(form.follow_up_date), // Save as follow_up_date, NOT estimated_delivery_date
        assigned_to: currentUser?._id, // Auto-assign to current employee
      }
      
      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }
      
      await apiRequest('/dc-orders/create', { method: 'POST', body: JSON.stringify(payload) })
      toast.success('New school lead created successfully!')
      router.push('/dashboard/leads/followup')
    } catch (err: any) {
      setError(err?.message || 'Failed to create lead')
      toast.error(err?.message || 'Failed to create lead')
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
            <Label>School Type</Label>
            <Select value={form.school_type} onValueChange={(v) => setForm((f) => ({ ...f, school_type: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact person *</Label>
            <Input className="bg-white text-neutral-900" name="contact_person" value={form.contact_person} onChange={onChange} required />
          </div>
          <div>
            <Label>Contact mobile *</Label>
            <Input className="bg-white text-neutral-900" name="contact_mobile" value={form.contact_mobile} onChange={onChange} required />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="bg-white text-neutral-900" type="email" name="email" value={form.email} onChange={onChange} />
          </div>
          <div>
            <Label>Decision Maker Name *</Label>
            <Input className="bg-white text-neutral-900" name="decision_maker_name" value={form.decision_maker_name} onChange={onChange} required />
          </div>
          <div>
            <Label>Decision Maker Mobile Number *</Label>
            <Input className="bg-white text-neutral-900" name="decision_maker_mobile" value={form.decision_maker_mobile} onChange={onChange} required />
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
            <div className="space-y-2 mt-2 p-4 bg-white rounded border">
              {products.map((product, index) => {
                const isHotOrWarm = product.status === 'Hot' || product.status === 'Warm'
                return (
                  <div
                    key={product.name}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-2 hover:bg-gray-50 rounded"
                  >
                    <div className="flex items-center space-x-2 min-w-[160px]">
                    <Checkbox
                      id={`product-${index}`}
                      checked={product.checked}
                      onCheckedChange={(checked) => handleProductCheck(index, checked as boolean)}
                    />
                    <Label htmlFor={`product-${index}`} className="font-medium cursor-pointer">
                      {product.name}
                    </Label>
                  </div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      <div className="w-28">
                    <Select
                      value={product.term || 'Term 1'}
                      onValueChange={(value) => handleProductTermChange(index, value)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white text-neutral-900">
                        <SelectValue placeholder="Term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                      </div>
                      <div className="w-40">
                        <Select
                          value={product.status}
                          onValueChange={(value) =>
                            handleProductStatusChange(
                              index,
                              value as ProductSelection['status'],
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-white text-neutral-900">
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
                      <div className="w-28">
                        <Input
                          type="number"
                          min={0}
                          disabled={!isHotOrWarm}
                          className="h-8 text-xs bg-white text-neutral-900"
                          placeholder="Strength"
                          value={product.strength}
                          onChange={(e) =>
                            handleProductStrengthChange(index, Number(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="w-28 flex items-center">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!isHotOrWarm}
                          className="h-8 text-xs bg-white text-neutral-900"
                          placeholder="%"
                          value={product.chance}
                          onChange={(e) =>
                            handleProductChanceChange(index, Number(e.target.value) || 0)
                          }
                        />
                        <span className="ml-1 text-xs text-neutral-500">%</span>
                      </div>
                  </div>
                </div>
                )
              })}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Select products, then set Term, Status, Strength, and Chance % for each.
              Strength is required when status is Hot or Warm; other statuses will always
              have 0 strength and 0% chance.
            </p>
          </div>

          <div>
            <Label>Zone</Label>
            <Input 
              className="bg-neutral-100 text-neutral-900 cursor-not-allowed" 
              name="zone" 
              value={form.zone} 
              onChange={onChange}
              readOnly
              disabled
            />
            <p className="text-xs text-neutral-500 mt-1">
              Zone is automatically set based on your assigned zone
            </p>
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
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create New School Lead'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

