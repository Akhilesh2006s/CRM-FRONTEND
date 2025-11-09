'use client'

import { useState, useEffect } from 'react'
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
  products?: Array<{ product_name: string }>
}

const availableProducts = ['Abacus', 'Vedic Maths', 'EELL', 'IIT', 'CodeChamp', 'Math Lab']

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    school_name: '',
    school_type: '',
    contact_person: '',
    contact_mobile: '',
    email: '',
    contact_person2: '',
    contact_mobile2: '',
    location: '',
    city: '',
    address: '',
    pincode: '',
    state: '',
    region: '',
    area: '',
    priority: 'Cold',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    follow_up_date: '',
  })
  
  const [products, setProducts] = useState<ProductSelection[]>(
    availableProducts.map(p => ({ name: p, checked: false }))
  )
  
  const [loadingPincode, setLoadingPincode] = useState(false)
  const [areas, setAreas] = useState<Array<{ name: string; district: string; block?: string; branchType?: string }>>([])

  useEffect(() => {
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
        setForm({
          school_name: lead.school_name || '',
          school_type: lead.school_type || '',
          contact_person: lead.contact_person || '',
          contact_mobile: lead.contact_mobile || '',
          email: lead.email || '',
          contact_person2: lead.contact_person2 || '',
          contact_mobile2: lead.contact_mobile2 || '',
          location: lead.location || '',
          city: lead.city || '',
          address: lead.address || '',
          pincode: lead.pincode || '',
          state: lead.state || '',
          region: lead.region || '',
          area: lead.area || '',
          priority: lead.priority || 'Cold',
          zone: lead.zone || '',
          branches: lead.branches?.toString() || '',
          strength: lead.strength?.toString() || '',
          remarks: lead.remarks || '',
          follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().split('T')[0] : '',
        })
        
        // Set products
        if (lead.products && lead.products.length > 0) {
          const productNames = lead.products.map(p => p.product_name || p)
          setProducts(availableProducts.map(p => ({
            name: p,
            checked: productNames.includes(p),
          })))
        }
      }
    } catch (err: any) {
      toast.error('Failed to load lead details')
      console.error(err)
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
            location: response.town || '',
            city: response.district || '',
            state: response.state || '',
            region: response.region || '',
          }))
          
          if (response.postOffices && response.postOffices.length > 0) {
            setAreas(response.postOffices.map(po => ({
              name: po.Name,
              district: po.District,
              block: po.Block,
              branchType: po.BranchType,
            })))
            if (response.postOffices.length === 1) {
              setForm((f) => ({ ...f, area: response.postOffices![0].Name }))
            }
          } else {
            setAreas([{ name: response.town, district: response.district || '' }])
            setForm((f) => ({ ...f, area: response.town || '' }))
          }
        }
      } catch (err: any) {
        console.error('Pincode lookup failed:', err)
        setAreas([])
      } finally {
        setLoadingPincode(false)
      }
    } else {
      if (pincode.length < 6) {
        setAreas([])
        setForm((f) => ({ ...f, location: '', city: '', state: '', region: '', area: '' }))
      }
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
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        location: form.location,
        city: form.city,
        address: form.address || undefined,
        pincode: form.pincode,
        state: form.state,
        region: form.region,
        area: form.area,
        zone: form.zone,
        priority: form.priority || 'Cold',
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks,
        email: form.email,
        products: selectedProducts,
        estimated_delivery_date: parseFollowUp(form.follow_up_date),
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
                <SelectItem value="Private">Private</SelectItem>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="Trust">Trust</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Existing">Existing</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
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
            <Label>Contact Person 2</Label>
            <Input className="bg-white text-neutral-900" name="contact_person2" value={form.contact_person2} onChange={onChange} />
          </div>
          <div>
            <Label>Contact Mobile 2</Label>
            <Input className="bg-white text-neutral-900" name="contact_mobile2" value={form.contact_mobile2} onChange={onChange} />
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
            <Label>Location/Town</Label>
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

          <div>
            <Label>Priority *</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))} required>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cold">Cold</SelectItem>
                <SelectItem value="Warm">Warm</SelectItem>
                <SelectItem value="Hot">Hot</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zone</Label>
            <Input className="bg-white text-neutral-900" name="zone" value={form.zone} onChange={onChange} />
          </div>
          <div>
            <Label>No. of Branches</Label>
            <Input className="bg-white text-neutral-900" type="number" name="branches" value={form.branches} onChange={onChange} />
          </div>
          <div>
            <Label>School strength (students)</Label>
            <Input className="bg-white text-neutral-900" type="number" name="strength" value={form.strength} onChange={onChange} />
          </div>
          <div>
            <Label>Follow-up date</Label>
            <Input className="bg-white text-neutral-900" type="date" name="follow_up_date" value={form.follow_up_date} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea className="bg-white text-neutral-900" name="remarks" value={form.remarks} onChange={onChange} />
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



