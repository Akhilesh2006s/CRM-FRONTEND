'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Package, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

type Lead = {
  _id: string
  school_name?: string
  contact_person?: string
  contact_mobile?: string
  contact_person2?: string
  contact_mobile2?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  strength?: number
  branches?: number
  decision_maker?: string
  products?: any[]
  priority?: string
  remarks?: string
  school_type?: string
}

const availableProducts = ['ABACUS', 'VedicMath', 'EELL', 'IIT', 'CODING', 'MathLab', 'CodeChamp', 'Math Lab']

export default function CloseLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    contact_person2: '',
    contact_mobile2: '',
    decision_maker: '',
    address: '',
    strength: '',
    branches: '',
    delivery_date: '',
    year: '2025-26',
    category: '',
  })
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productDialogOpen, setProductDialogOpen] = useState(false)

  useEffect(() => {
    if (leadId) {
      loadLead()
    }
  }, [leadId])

  const loadLead = async () => {
    setLoading(true)
    try {
      // Try to get from dc-orders first
      let leadData: any = null
      try {
        leadData = await apiRequest<any>(`/dc-orders/${leadId}`)
      } catch {
        // If not found, try leads API
        leadData = await apiRequest<any>(`/leads/${leadId}`)
      }
      
      if (leadData) {
        setLead(leadData)
        // Pre-fill form with lead data
        setForm({
          contact_person2: leadData.contact_person2 || '',
          contact_mobile2: leadData.contact_mobile2 || '',
          decision_maker: leadData.decision_maker || leadData.contact_person || '',
          address: leadData.address || leadData.location || '',
          strength: leadData.strength?.toString() || '',
          branches: leadData.branches?.toString() || '',
          delivery_date: leadData.estimated_delivery_date 
            ? new Date(leadData.estimated_delivery_date).toISOString().split('T')[0]
            : '',
          year: '2025-26',
          category: leadData.schoolCategory || '',
        })
        
        // Pre-fill selected products - normalize product names to match availableProducts
        // Only set products that exactly match availableProducts
        let validProducts: string[] = []
        
        if (leadData.products && Array.isArray(leadData.products) && leadData.products.length > 0) {
          validProducts = leadData.products
            .map((p: any) => {
              const name = p.product_name || p.product || p
              if (typeof name === 'string') {
                const normalized = name.trim()
                // Map variations to exact names
                if (normalized.toLowerCase() === 'mathlab' || normalized.toLowerCase() === 'math lab') {
                  return 'MathLab'
                }
                if (normalized.toLowerCase() === 'codechamp') {
                  return 'CodeChamp'
                }
                if (normalized.toLowerCase() === 'vedicmath' || normalized.toLowerCase() === 'vedic math') {
                  return 'VedicMath'
                }
                return normalized
              }
              return null
            })
            .filter((name: string | null): name is string => {
              return name !== null && availableProducts.includes(name)
            })
        } else if (typeof leadData.products === 'string' && leadData.products.trim()) {
          validProducts = leadData.products
            .split(',')
            .map((p: string) => {
              const normalized = p.trim()
              // Normalize product names
              if (normalized.toLowerCase() === 'mathlab' || normalized.toLowerCase() === 'math lab') {
                return 'MathLab'
              }
              if (normalized.toLowerCase() === 'codechamp') {
                return 'CodeChamp'
              }
              if (normalized.toLowerCase() === 'vedicmath' || normalized.toLowerCase() === 'vedic math') {
                return 'VedicMath'
              }
              return normalized
            })
            .filter((name: string) => availableProducts.includes(name))
        }
        
        // Only set products if we have valid matches
        setSelectedProducts(validProducts)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead')
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  const handleProductCheck = (product: string, checked: boolean) => {
    if (checked) {
      // Only add if not already in the array
      if (!selectedProducts.includes(product)) {
        setSelectedProducts([...selectedProducts, product])
      }
    } else {
      // Remove from array
      setSelectedProducts(selectedProducts.filter(p => p !== product))
    }
  }


  const handleTurnToClient = async () => {
    if (!lead) return
    
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      // First, update the lead with close form data and mark as completed/closed
      // Ensure the lead is assigned to the current user if not already assigned
      const assignedEmployeeId = lead.assigned_to 
        ? (typeof lead.assigned_to === 'object' ? lead.assigned_to._id : lead.assigned_to)
        : currentUser?._id
      
      const updatePayload: any = {
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        decision_maker: form.decision_maker || undefined,
        address: form.address || undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        branches: form.branches ? Number(form.branches) : undefined,
        estimated_delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
        schoolCategory: form.category || undefined,
        status: 'saved', // Mark as saved so it appears in employee's My Clients page
        assigned_to: assignedEmployeeId, // Ensure lead is assigned to employee
        products: selectedProducts.map(product => ({
          product_name: product,
          quantity: 1,
          unit_price: 0,
        })),
      }
      
      
      // Update the lead/dc-order
      try {
        await apiRequest(`/dc-orders/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      } catch {
        await apiRequest(`/leads/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      }
      
      // Now create DC automatically - this will make it appear in employee's My Clients page
      const dcPayload: any = {
        dcOrderId: leadId,
        dcDate: form.delivery_date || new Date().toISOString(),
        dcRemarks: `Lead converted to client - ${lead.school_name}`,
        dcCategory: form.category || 'Standard',
        requestedQuantity: selectedProducts.length,
        employeeId: assignedEmployeeId, // Use the same assigned employee ID
      }
      
      const dc = await apiRequest('/dc/raise', {
        method: 'POST',
        body: JSON.stringify(dcPayload),
      })
      
      toast.success('Lead converted to client! DC created successfully. It will appear in My Clients page.')
      // Redirect to employee's DC page (My Clients)
      router.push('/dashboard/dc/my')
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client')
      toast.error(err?.message || 'Failed to convert lead to client')
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

  if (error && !lead) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-red-500">{error}</div>
        <Link href="/dashboard/leads/followup">
          <Button variant="outline">Back to Followup Leads</Button>
        </Link>
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
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Close Lead</h1>
          <p className="text-sm text-neutral-600 mt-1">Fill in the details to close this lead and convert to client</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* School Name (Read-only) */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">School Name</Label>
            <Input
              value={lead?.school_name || ''}
              disabled
              className="bg-neutral-50 mt-1"
            />
          </div>

          {/* Person 1 (Read-only) */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Person 1</Label>
            <Input
              value={lead?.contact_person || ''}
              disabled
              className="bg-neutral-50 mt-1"
            />
          </div>

          {/* Email 1 (Read-only) */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Email 1</Label>
            <Input
              value={lead?.email || ''}
              disabled
              className="bg-neutral-50 mt-1"
            />
          </div>

          {/* Mob 1 (Read-only) */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Mob 1</Label>
            <Input
              value={lead?.contact_mobile || ''}
              disabled
              className="bg-neutral-50 mt-1"
            />
          </div>

          {/* Person 2 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Person 2</Label>
            <Input
              value={form.contact_person2}
              onChange={(e) => setForm({ ...form, contact_person2: e.target.value })}
              placeholder="Enter second contact person"
              className="mt-1"
            />
          </div>

          {/* Mob 2 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Mob 2</Label>
            <Input
              value={form.contact_mobile2}
              onChange={(e) => setForm({ ...form, contact_mobile2: e.target.value })}
              placeholder="Enter second contact mobile"
              className="mt-1"
            />
          </div>

          {/* Decision Maker */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Decision Maker</Label>
            <Input
              value={form.decision_maker}
              onChange={(e) => setForm({ ...form, decision_maker: e.target.value })}
              placeholder="Enter decision maker name"
              className="mt-1"
            />
          </div>

          {/* Address */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Enter full address"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Strength */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Strength</Label>
            <Input
              type="number"
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
              placeholder="Enter student strength"
              className="mt-1"
            />
          </div>

          {/* Branches */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Branches</Label>
            <Input
              type="number"
              value={form.branches}
              onChange={(e) => setForm({ ...form, branches: e.target.value })}
              placeholder="Enter number of branches"
              className="mt-1"
            />
          </div>

          {/* Delivery Date */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Delivery Date</Label>
            <Input
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Select Year */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Select Year</Label>
            <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-25">2024-25</SelectItem>
                <SelectItem value="2025-26">2025-26</SelectItem>
                <SelectItem value="2026-27">2026-27</SelectItem>
                <SelectItem value="2027-28">2027-28</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categories */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Categories</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Category" />
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

          {/* Add Products Button */}
          <div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setProductDialogOpen(true)}
            >
              <Package className="w-4 h-4 mr-2" />
              ADD PRODUCTS {selectedProducts.length > 0 && `(${selectedProducts.length})`}
            </Button>
          </div>


          {/* Turn Lead to Client Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleTurnToClient}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Turn Lead to Client
                </span>
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Select Products</DialogTitle>
            <DialogDescription>Choose the products for this lead</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {availableProducts.map((product) => {
              const isChecked = selectedProducts.includes(product)
              return (
                <div key={product} className="flex items-center space-x-2">
                  <Checkbox
                    id={`product-${product}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleProductCheck(product, checked as boolean)}
                  />
                  <label
                    htmlFor={`product-${product}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    onClick={() => handleProductCheck(product, !isChecked)}
                  >
                    {product}
                  </label>
                </div>
              )
            })}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setProductDialogOpen(false)}>
              Done ({selectedProducts.length} selected)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

