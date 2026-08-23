'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
import { toFollowUpDateInputValue, toFollowUpDatePayload } from '@/lib/followUpDate'

type ProductSelection = {
  name: string
  checked: boolean
}

type Lead = {
  _id: string
  school_name?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  contact_person2?: string
  contact_mobile2?: string
  email?: string
  location?: string
  city?: string
  address?: string
  pincode?: string
  state?: string
  region?: string
  area?: string
  priority?: string
  zone?: string
  branches?: number
  strength?: number
  remarks?: string
  follow_up_date?: string
  estimated_delivery_date?: string
  average_fee?: number
  products?: Array<{ product_name: string }> | string
}

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  const { productNames: availableProducts } = useProducts()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    school_name: '',
    school_type: 'New',
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
    priority: 'Hot',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
  })
  
  const [products, setProducts] = useState<ProductSelection[]>([])
  const [loadedLead, setLoadedLead] = useState<Lead | null>(null)
  const productsProcessedRef = useRef<string>('')
  
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [areas, setAreas] = useState<Array<{ name: string; district: string; block?: string; branchType?: string }>>([])

  // Set products when both availableProducts and loadedLead are ready
  useEffect(() => {
    // Only proceed if we have available products
    if (availableProducts.length === 0) return
    
    // Create a unique key for this combination to prevent reprocessing
    const leadId = loadedLead?._id || ''
    const productsKey = loadedLead?.products 
      ? (Array.isArray(loadedLead.products) 
          ? JSON.stringify(loadedLead.products.map((p: any) => typeof p === 'string' ? p : (p.product_name || p.product || p)))
          : String(loadedLead.products))
      : ''
    const currentKey = `${leadId}-${productsKey}-${availableProducts.join(',')}`
    
    // Skip if we've already processed this combination
    if (productsProcessedRef.current === currentKey) return
    
    if (loadedLead) {
      let productNames: string[] = []
      
      // Handle both array and string formats (for backward compatibility)
      if (loadedLead.products) {
        if (Array.isArray(loadedLead.products)) {
          productNames = loadedLead.products.map((p: any) => {
            if (typeof p === 'string') return p
            return p.product_name || p.product || p
          })
        } else if (typeof loadedLead.products === 'string') {
          // Handle old string format - try to parse as comma-separated or JSON
          const productsStr = loadedLead.products.trim()
          if (productsStr) {
            try {
              const parsed = JSON.parse(productsStr)
              if (Array.isArray(parsed)) {
                productNames = parsed.map((p: any) => typeof p === 'string' ? p : (p.product_name || p.product || p))
              } else {
                productNames = productsStr.split(',').map(p => p.trim()).filter(p => p)
              }
            } catch {
              // If not JSON, treat as comma-separated string
              productNames = productsStr.split(',').map(p => p.trim()).filter(p => p)
            }
          }
        }
      }
      
      const newProducts = availableProducts.map(p => ({
        name: p,
        checked: productNames.includes(p),
      }))
      
      setProducts(newProducts)
      productsProcessedRef.current = currentKey
    } else {
      // Initialize with all unchecked if no lead loaded yet
      const noLeadKey = `no-lead-${availableProducts.join(',')}`
      if (productsProcessedRef.current !== noLeadKey) {
        setProducts(availableProducts.map(p => ({ name: p, checked: false })))
        productsProcessedRef.current = noLeadKey
      }
    }
  }, [availableProducts, loadedLead])

  useEffect(() => {
    // Reset the processed ref when leadId changes
    productsProcessedRef.current = ''
    loadLead()
  }, [leadId])

  const loadLead = async () => {
    setLoading(true)
    try {
      // Try to load from leads API first
      let lead: Lead | null = null
      try {
        lead = await apiRequest<Lead>(`/leads/${leadId}`)
      } catch {
        // If not found, try dc-orders
        lead = await apiRequest<Lead>(`/dc-orders/${leadId}`)
      }
      
      if (lead) {
        // Debug: Log the FULL lead data to see what we're getting
        console.log('=== FULL LEAD DATA FROM API ===')
        console.log('Full lead object:', JSON.stringify(lead, null, 2))
        console.log('Specific fields:', {
          pincode: lead.pincode,
          state: lead.state,
          city: lead.city,
          region: lead.region,
          area: lead.area,
          location: lead.location, // This is the landmark
          average_fee: lead.average_fee,
          follow_up_date: lead.follow_up_date,
          estimated_delivery_date: lead.estimated_delivery_date,
          strength: lead.strength,
          branches: lead.branches,
        })
        console.log('Location (landmark) value:', lead.location)
        console.log('Strength value:', lead.strength)
        console.log('Products value:', lead.products, 'Type:', typeof lead.products, 'IsArray:', Array.isArray(lead.products))
        
        // Store the loaded lead so products can be set when availableProducts are ready
        setLoadedLead(lead)
        
        setForm({
          school_name: lead.school_name || '',
          school_type: lead.school_type || 'New',
          contact_person: lead.contact_person || '',
          contact_mobile: lead.contact_mobile || '',
          email: lead.email || '',
          decision_maker_name: lead.contact_person2 || '',
          decision_maker_mobile: lead.contact_mobile2 || '',
          location: lead.location || '',
          city: lead.city || '',
          address: lead.address || '',
          pincode: lead.pincode || '',
          state: lead.state || '',
          region: lead.region || '',
          area: lead.area || '',
          priority: lead.priority || 'Hot',
          zone: lead.zone || '',
          branches: lead.branches?.toString() || '',
          strength: lead.strength?.toString() || '',
          remarks: lead.remarks || '',
          average_fee: lead.average_fee?.toString() || '',
          follow_up_date: toFollowUpDateInputValue(lead.follow_up_date || lead.estimated_delivery_date),
        })
        
        // If pincode exists, load areas
        if (lead.pincode && lead.pincode.length === 6) {
          try {
            const response = await lookupPincode(lead.pincode)
            if (response.success && response.postOffices?.length) {
              setAreas(response.postOffices)
            }
          } catch (err) {
            console.error('Failed to load areas for pincode:', err)
          }
        }
        
        // Products will be set by the useEffect that watches availableProducts and loadedLead
      } else {
        setLoadedLead(null)
      }
    } catch (err: any) {
      toast.error('Failed to load lead details')
      console.error(err)
      setLoadedLead(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePincodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pincode = e.target.value.replace(/\D/g, '').slice(0, 6)
    setForm((f) => ({ ...f, pincode }))

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
          toast.error(response.message || 'Could not find this pincode.')
        }
      } catch (err: unknown) {
        console.error('Pincode lookup failed:', err)
        setAreas([])
        toast.error(
          err instanceof Error ? err.message : 'Pincode lookup failed. Enter location manually.',
        )
      } finally {
        setLoadingPincode(false)
      }
    } else if (pincode.length < 6) {
      setAreas([])
      setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }))
    }
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleProductCheck = (index: number, checked: boolean) => {
    const updated = [...products]
    updated[index].checked = checked
    setProducts(updated)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const selectedProducts = products
        .filter(p => p.checked)
        .map(p => ({
          product_name: p.name,
          quantity: 1,
          unit_price: 0,
        }))
      
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type || undefined,
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.decision_maker_name || undefined, // Mapped for backend compatibility
        contact_mobile2: form.decision_maker_mobile || undefined, // Mapped for backend compatibility
        location: form.location, // Landmark
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        zone: form.zone,
        priority: form.priority || 'Hot',
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: selectedProducts,
        follow_up_date: toFollowUpDatePayload(form.follow_up_date), // Date only — no default time
      }
      
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
      
      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }
      
      // Try to update via leads API first, then dc-orders
      try {
        await apiRequest(`/leads/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } catch {
        await apiRequest(`/dc-orders/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      }
      
      toast.success('Lead details updated successfully!')
      router.push('/dashboard/leads/followup')
    } catch (err: any) {
      setError(err?.message || 'Failed to update lead')
      toast.error(err?.message || 'Failed to update lead')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading lead details...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads/followup">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Lead Details</h1>
          <p className="text-sm text-neutral-600 mt-1">Update the lead information</p>
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
            <Label>City</Label>
            <Input className="bg-white text-neutral-900" name="city" value={form.city} onChange={onChange} />
          </div>
          <div>
            <Label>Region</Label>
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
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" name="address" value={form.address} onChange={onChange} />
          </div>
          
          {/* Products Interested Section */}
          <div className="md:col-span-2">
            <Label>Products Interested *</Label>
            <div className="space-y-2 mt-2 p-4 bg-white rounded border">
              {products.map((product, index) => (
                <div key={product.name} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={`product-${index}`}
                    checked={product.checked}
                    onCheckedChange={(checked) => handleProductCheck(index, checked as boolean)}
                  />
                  <Label htmlFor={`product-${index}`} className="font-medium cursor-pointer">
                    {product.name}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Select the products the school is interested in.
            </p>
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

          <div>
            <Label>Priority *</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))} required>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hot">Hot</SelectItem>
                <SelectItem value="Warm">Warm</SelectItem>
                <SelectItem value="Visit Again">Visit Again</SelectItem>
                <SelectItem value="Not Met Management">Not Met Management</SelectItem>
                <SelectItem value="Not Interested">Not Interested</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Input className="bg-white text-neutral-900" name="zone" value={form.zone} onChange={onChange} />
          </div>
          <div>
            <Label>Follow-up date</Label>
            <Input className="bg-white text-neutral-900" type="date" name="follow_up_date" value={form.follow_up_date} onChange={onChange} />
          </div>
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Updating...' : 'Update Lead Details'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}




