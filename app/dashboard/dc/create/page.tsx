'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

type ProductSelection = {
  name: string
  checked: boolean
  price: number
  quantity: number
  strength?: number
}

export default function CreateDealPage() {
  const router = useRouter()
  const availableProducts = ['Abacus', 'Vedic Maths', 'EELL', 'IIT', 'CodeChamp', 'Math Lab']
  
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
    lead_status: 'pending',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    follow_up_date: '',
    assigned_to: '',
  })
  
  // Product selections with individual price/quantity
  const [products, setProducts] = useState<ProductSelection[]>(
    availableProducts.map(p => ({ name: p, checked: false, price: 0, quantity: 1, strength: 0 }))
  )
  
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  useEffect(() => {
    ;(async () => {
      setLoadingEmployees(true)
      try {
        const data = await apiRequest<any[]>('/employees?isActive=true')
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleProductCheck = (index: number, checked: boolean) => {
    const updated = [...products]
    updated[index].checked = checked
    setProducts(updated)
  }

  const handleProductFieldChange = (index: number, field: 'price' | 'quantity' | 'strength', value: number) => {
    const updated = [...products]
    updated[index][field] = value
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
      
      // Build products array from checked products
      const selectedProducts = products
        .filter(p => p.checked)
        .map(p => ({
          product_name: p.name,
          quantity: p.quantity || 1,
          unit_price: p.price || 0,
          strength: p.strength || 0,
        }))
      
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type || undefined,
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        location: form.location,
        address: form.address || undefined,
        zone: form.zone,
        status: form.lead_status || 'pending',
        branches: form.branches ? Number(form.branches) : undefined,
        remarks: form.remarks,
        email: form.email,
        products: selectedProducts,
        estimated_delivery_date: parseFollowUp(form.follow_up_date),
        assigned_to: form.assigned_to,
      }
      
      if (!form.assigned_to) {
        throw new Error('Please assign the deal to an executive. DC will not be created without assignment.')
      }
      
      if (selectedProducts.length === 0) {
        throw new Error('Please select at least one product.')
      }
      
      await apiRequest('/dc-orders/create', { method: 'POST', body: JSON.stringify(payload) })
      alert('Deal created successfully! DC entry has been automatically created. You can now submit PO in "My DCs" page.')
      router.push('/dashboard/dc/my')
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
            <Label>Location/Town</Label>
            <Input className="bg-white text-neutral-900" name="location" value={form.location} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea className="bg-white text-neutral-900" name="address" value={form.address} onChange={onChange} />
          </div>
          
          {/* Products Section with Checkboxes and Price/Quantity */}
          <div className="md:col-span-2">
            <Label>Products *</Label>
            <div className="space-y-3 mt-2 p-4 bg-white rounded border">
              {products.map((product, index) => (
                <div key={product.name} className="flex items-center gap-4 p-2 border rounded hover:bg-gray-50">
                  <div className="flex items-center space-x-2 min-w-[200px]">
                    <Checkbox
                      id={`product-${index}`}
                      checked={product.checked}
                      onCheckedChange={(checked) => handleProductCheck(index, checked as boolean)}
                    />
                    <Label htmlFor={`product-${index}`} className="font-medium cursor-pointer">
                      {product.name}
                    </Label>
                  </div>
                  
                  {product.checked && (
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Price (₹)</Label>
                        <Input
                          type="number"
                          className="bg-white text-neutral-900 h-8"
                          value={product.price || ''}
                          onChange={(e) => handleProductFieldChange(index, 'price', Number(e.target.value) || 0)}
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          className="bg-white text-neutral-900 h-8"
                          value={product.quantity || ''}
                          onChange={(e) => handleProductFieldChange(index, 'quantity', Number(e.target.value) || 1)}
                          placeholder="1"
                          min="1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Strength</Label>
                        <Input
                          type="number"
                          className="bg-white text-neutral-900 h-8"
                          value={product.strength || ''}
                          onChange={(e) => handleProductFieldChange(index, 'strength', Number(e.target.value) || 0)}
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Check products to enable Price, Quantity, and Strength fields for each product.
            </p>
          </div>

          <div>
            <Label>Lead Status</Label>
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
            <Label>No. of Branches</Label>
            <Input className="bg-white text-neutral-900" type="number" name="branches" value={form.branches} onChange={onChange} />
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
            <Label>School strength (students)</Label>
            <Input className="bg-white text-neutral-900" type="number" name="strength" value={form.strength} onChange={onChange} />
          </div>
          <div>
            <Label>Follow-up date</Label>
            <Input className="bg-white text-neutral-900 placeholder:text-neutral-500" placeholder="dd-mm-yyyy" name="follow_up_date" value={form.follow_up_date} onChange={onChange} />
          </div>
          <div className="md:col-span-2">
            <Label>Remarks</Label>
            <Textarea className="bg-white text-neutral-900" name="remarks" value={form.remarks} onChange={onChange} />
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
    </div>
  )
}
