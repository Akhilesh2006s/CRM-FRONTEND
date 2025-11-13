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
import { ArrowLeft, Package, CheckCircle2, Upload, X, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useProducts } from '@/hooks/useProducts'

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
  })
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productDetails, setProductDetails] = useState<Array<{
    id: string
    product: string
    class: string
    category: string
    quantity: number
    strength: number
    price: number
    total: number
    level: string
    specs: string
  }>>([])
  const [poPhoto, setPoPhoto] = useState<File | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState<string>('')
  const [uploadingPO, setUploadingPO] = useState(false)
  
  const { productNames: availableProducts, getProductLevels, getDefaultLevel, getProductSpecs } = useProducts()
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const availableCategories = ['New Students', 'Existing Students', 'Both']
  const availableDCCategories = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

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
        const deliveryDate = leadData.estimated_delivery_date 
          ? new Date(leadData.estimated_delivery_date).toISOString().split('T')[0]
          : ''
        setForm({
          contact_person2: leadData.contact_person2 || '',
          contact_mobile2: leadData.contact_mobile2 || '',
          decision_maker: leadData.decision_maker || leadData.contact_person || '',
          address: leadData.address || leadData.location || '',
          strength: leadData.strength?.toString() || '',
          branches: leadData.branches?.toString() || '',
                delivery_date: deliveryDate,
                year: '2025-26',
        })
        
        // Pre-fill selected products and product details - normalize product names to match availableProducts
        // Only set products that exactly match availableProducts
        let validProducts: string[] = []
        let initialProductDetails: Array<{
          id: string
          product: string
          class: string
          category: string
          quantity: number
          strength: number
          price: number
          total: number
          level: string
        }> = []
        
        if (leadData.products && Array.isArray(leadData.products) && leadData.products.length > 0) {
          validProducts = leadData.products
            .map((p: any) => {
              const name = p.product_name || p.product || p
              if (typeof name === 'string') {
                const normalized = name.trim()
                // Map variations to exact names
                const lower = normalized.toLowerCase()
                if (lower === 'mathlab' || lower === 'math lab' || lower === 'maths lab') {
                  return 'Maths lab'
                }
                if (lower === 'codechamp' || lower === 'code champ') {
                  return 'Codechamp'
                }
                if (lower === 'vedicmath' || lower === 'vedic math') {
                  return 'Vedic Maths'
                }
                if (lower === 'financial literacy' || lower === 'financialliteracy') {
                  return 'Financial literacy'
                }
                if (lower === 'brain bytes' || lower === 'brainbytes') {
                  return 'Brain bytes'
                }
                if (lower === 'spelling bee' || lower === 'spellingbee') {
                  return 'Spelling bee'
                }
                if (lower === 'skill pro' || lower === 'skillpro') {
                  return 'Skill pro'
                }
                if (lower === 'abacus') {
                  return 'Abacus'
                }
                if (lower === 'eel' || lower === 'eell') {
                  return 'EEL'
                }
                if (lower === 'iit') {
                  return 'IIT'
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
              const lower = normalized.toLowerCase()
              if (lower === 'mathlab' || lower === 'math lab' || lower === 'maths lab') {
                return 'Maths lab'
              }
              if (lower === 'codechamp' || lower === 'code champ') {
                return 'Codechamp'
              }
              if (lower === 'vedicmath' || lower === 'vedic math') {
                return 'Vedic Maths'
              }
              if (lower === 'financial literacy' || lower === 'financialliteracy') {
                return 'Financial literacy'
              }
              if (lower === 'brain bytes' || lower === 'brainbytes') {
                return 'Brain bytes'
              }
              if (lower === 'spelling bee' || lower === 'spellingbee') {
                return 'Spelling bee'
              }
              if (lower === 'skill pro' || lower === 'skillpro') {
                return 'Skill pro'
              }
              if (lower === 'abacus') {
                return 'Abacus'
              }
              if (lower === 'eel' || lower === 'eell') {
                return 'EEL'
              }
              if (lower === 'iit') {
                return 'IIT'
              }
              return normalized
            })
            .filter((name: string) => availableProducts.includes(name))
        }
        
        // Only set products if we have valid matches
        setSelectedProducts(validProducts)
        
          // Initialize product details for valid products
        if (validProducts.length > 0) {
          const details = validProducts.map((product, idx) => {
            const productData = leadData.products?.find((p: any) => 
              (p.product_name || p.product || p) === product
            )
            const productSpecs = getProductSpecs(product)
            return {
              id: Date.now().toString() + idx,
              product: product,
              class: productData?.class || '1',
              category: leadData.school_type === 'Existing' ? 'Existing Students' : 'New Students',
              quantity: productData?.quantity || 1,
              strength: productData?.strength || 0,
              price: productData?.unit_price || productData?.price || 0,
              total: (productData?.unit_price || productData?.price || 0) * (productData?.quantity || 1),
              level: productData?.level || getDefaultLevel(product),
              specs: productData?.specs || (productSpecs.length > 0 ? productSpecs[0] : 'Regular'),
            }
          })
          setProductDetails(details)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead')
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  const addProductWithSpec = (product: string, spec: string) => {
    // Add product with specific spec - allows multiple instances of same product with different specs
    setSelectedProducts([...selectedProducts, product])
    setProductDetails([...productDetails, {
      id: Date.now().toString() + Math.random().toString(),
      product: product,
      class: '1',
        category: lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students',
      quantity: 1,
      strength: 0,
      price: 0,
      total: 0,
      level: getDefaultLevel(product),
      specs: spec,
    }])
  }
  
  const updateProductDetail = (id: string, field: string, value: any) => {
    setProductDetails(productDetails.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value }
        // Auto-calculate total when price or quantity changes
        if (field === 'price' || field === 'quantity') {
          updated.total = (Number(updated.price) || 0) * (Number(updated.quantity) || 0)
        }
        return updated
      }
      return p
    }))
  }
  
  const removeProductDetail = (id: string) => {
    // Remove only this specific product instance (by ID)
    // Don't remove from selectedProducts array - same product can appear multiple times with different specs
    setProductDetails(productDetails.filter(p => p.id !== id))
    // Update selectedProducts to match remaining productDetails
    const remainingProducts = productDetails
      .filter(p => p.id !== id)
      .map(p => p.product)
    setSelectedProducts(remainingProducts)
  }
  
  const handlePOPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type - allow images and PDFs
    const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isValidType) {
      toast.error('Please upload an image file (JPG, PNG) or PDF')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    
    setPoPhoto(file)
    setUploadingPO(true)
    
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('poPhoto', file)
      
      // Upload to backend
      const response = await fetch(`${API_BASE_URL}/api/dc/upload-po`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload PO document')
      }
      
      const data = await response.json()
      setPoPhotoUrl(data.poPhotoUrl || data.url || '')
      toast.success('PO document uploaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload PO document')
      setPoPhoto(null)
    } finally {
      setUploadingPO(false)
    }
  }

  const handleTurnToClient = async () => {
    if (!lead) return
    
    if (productDetails.length === 0) {
      toast.error('Please add at least one product with details')
      return
    }
    
    // Validate product details
    const invalidProducts = productDetails.filter(p => !p.product || !p.quantity || !p.strength)
    if (invalidProducts.length > 0) {
      toast.error('Please fill in Product, Quantity, and Strength for all products')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      // Always use current user's ID for the DC - the employee converting the lead owns the client
      if (!currentUser?._id) {
        toast.error('User not found. Please login again.')
        setSubmitting(false)
        return
      }
      
      const assignedEmployeeId = currentUser._id
      
      // First, update the lead with close form data and mark as completed/closed
      const updatePayload: any = {
        contact_person2: form.contact_person2 || undefined,
        contact_mobile2: form.contact_mobile2 || undefined,
        decision_maker: form.decision_maker || undefined,
        address: form.address || undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        branches: form.branches ? Number(form.branches) : undefined,
        estimated_delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
        status: 'saved', // Mark as saved so it appears in employee's My Clients page
        assigned_to: assignedEmployeeId,
        products: productDetails.map(p => ({
          product_name: p.product,
          quantity: p.quantity,
          unit_price: p.price,
        })),
      }
      
      // Update the lead/dc-order
      console.log('🔄 Updating DcOrder with payload:', {
        leadId,
        status: updatePayload.status,
        assigned_to: updatePayload.assigned_to,
        hasProducts: !!updatePayload.products
      });
      
      try {
        const updated = await apiRequest(`/dc-orders/${leadId}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
        console.log('✅ DcOrder updated successfully:', {
          id: updated._id,
          status: updated.status,
          assigned_to: updated.assigned_to
        });
      } catch (err: any) {
        console.warn('⚠️ DcOrder update failed, trying leads API:', err?.message);
        try {
          const updated = await apiRequest(`/leads/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          })
          console.log('✅ Lead updated successfully (via leads API):', {
            id: updated._id,
            status: updated.status
          });
        } catch (leadErr: any) {
          console.error('❌ Both update attempts failed:', leadErr);
          throw leadErr; // Re-throw to be caught by outer catch
        }
      }
      
      // Prepare product details for DC
      const dcProductDetails = productDetails.map(p => ({
        product: p.product,
        class: p.class || '1',
        category: p.category || (lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students'),
        quantity: Number(p.quantity) || 0,
        strength: Number(p.strength) || 0,
        price: Number(p.price) || 0,
        total: Number(p.total) || (Number(p.price) || 0) * (Number(p.quantity) || 0),
        level: p.level || getDefaultLevel(p.product),
        specs: p.specs || 'Regular', // Include specs
      }))
      
      const totalQuantity = dcProductDetails.reduce((sum, p) => sum + (p.quantity || 0), 0)
      
      // Create DC with all details
      const dcPayload: any = {
        dcOrderId: leadId,
        dcDate: form.delivery_date || new Date().toISOString(),
        dcRemarks: `Lead converted to client - ${lead.school_name}`,
        dcCategory: lead.school_type === 'Existing' ? 'Existing School' : 'New School',
        requestedQuantity: totalQuantity,
        employeeId: assignedEmployeeId,
        productDetails: dcProductDetails,
        status: 'created', // Set to 'created' so it appears in "My Clients" page immediately
      }
      
      // Add PO photo if uploaded
      if (poPhotoUrl) {
        dcPayload.poPhotoUrl = poPhotoUrl
        dcPayload.poDocument = poPhotoUrl
      }
      
      console.log('🔄 Creating DC with payload:', {
        dcOrderId: dcPayload.dcOrderId,
        employeeId: dcPayload.employeeId,
        status: dcPayload.status,
        productDetailsCount: dcPayload.productDetails?.length
      });
      
      const dc = await apiRequest('/dc/raise', {
        method: 'POST',
        body: JSON.stringify(dcPayload),
      })
      
      console.log('✅ DC created:', {
        dcId: dc._id,
        status: dc.status,
        customerName: dc.customerName
      });
      
      // If PO photo is provided, also submit PO
      if (poPhotoUrl && dc._id) {
        try {
          await apiRequest(`/dc/${dc._id}/submit-po`, {
            method: 'POST',
            body: JSON.stringify({ 
              poPhotoUrl: poPhotoUrl,
            }),
          })
        } catch (poErr) {
          console.error('Failed to submit PO:', poErr)
          // Don't fail the whole operation if PO submission fails
        }
      }
      
      // Verify the conversion worked by checking if DC exists
      try {
        const verifyDC = await apiRequest(`/dc/${dc._id}`)
        console.log('✅ Verification - DC exists:', {
          id: verifyDC._id,
          status: verifyDC.status,
          employeeId: verifyDC.employeeId,
          dcOrderId: verifyDC.dcOrderId
        });
      } catch (verifyErr) {
        console.warn('⚠️ Could not verify DC creation (this is okay if query times out):', verifyErr);
      }
      
      toast.success('Lead converted to client! DC created and submitted to My Clients successfully.')
      
      // Store the DC ID in sessionStorage so the Client DC page can fetch it directly
      if (dc._id) {
        sessionStorage.setItem('newlyConvertedDCId', dc._id);
        sessionStorage.setItem('newlyConvertedDC', JSON.stringify(dc));
      }
      
      // Redirect to Client DC page
      router.push('/dashboard/dc/client-dc')
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

          {/* PO Document Upload */}
          <div className="pt-4 border-t">
            <Label className="text-sm font-semibold text-neutral-700">PO Document</Label>
            <div className="mt-1 space-y-2">
              {poPhotoUrl ? (
                <div className="flex items-center gap-2">
                  {poPhotoUrl.toLowerCase().endsWith('.pdf') ? (
                    <div className="h-20 w-20 flex items-center justify-center bg-red-100 rounded border">
                      <span className="text-xs font-semibold text-red-700">PDF</span>
                    </div>
                  ) : (
                    <img src={poPhotoUrl} alt="PO" className="h-20 w-20 object-cover rounded border" />
                  )}
                  <div className="flex flex-col gap-2">
                    <a
                      href={poPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Document
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPoPhotoUrl('')
                        setPoPhoto(null)
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handlePOPhotoUpload}
                    disabled={uploadingPO}
                    className="mt-1"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Accepted: JPG, PNG, PDF (max 5MB)</p>
                  {uploadingPO && <p className="text-xs text-neutral-500 mt-1">Uploading...</p>}
                </div>
              )}
            </div>
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
              ADD PRODUCTS {productDetails.length > 0 && `(${productDetails.length})`}
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
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products & Details</DialogTitle>
            <DialogDescription>Select products and enter their details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Add Products</Label>
              <p className="text-xs text-neutral-500 mb-2">You can add the same product multiple times with different specs</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
                {availableProducts.map((product) => {
                  const productSpecs = getProductSpecs(product)
                  const hasSpecs = productSpecs.length > 0
                  
                  return (
                    <div key={product} className="flex items-center justify-between p-2 border rounded hover:bg-neutral-50">
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="text-sm font-medium">{product}</span>
                        {hasSpecs && (
                          <span className="text-xs text-neutral-500">(Has Specs)</span>
                        )}
                      </div>
                      {hasSpecs ? (
                        <div className="flex gap-1">
                          {productSpecs.map(spec => (
                            <Button
                              key={spec}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addProductWithSpec(product, spec)}
                              className="text-xs"
                            >
                              <PlusCircle className="w-3 h-3 mr-1" />
                              {spec}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addProductWithSpec(product, 'Regular')}
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Product Details Table */}
            {productDetails.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Product Details</Label>
                <div className="border rounded overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Qty</th>
                        <th className="px-3 py-2 text-left">Strength</th>
                        <th className="px-3 py-2 text-left">Price</th>
                        <th className="px-3 py-2 text-left">Total</th>
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">Specs</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDetails.map((pd) => (
                        <tr key={pd.id} className="border-t">
                          <td className="px-3 py-2">{pd.product}</td>
                          <td className="px-3 py-2">
                            <Select value={pd.class} onValueChange={(v) => updateProductDetail(pd.id, 'class', v)}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableClasses.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={pd.category} onValueChange={(v) => updateProductDetail(pd.id, 'category', v)}>
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.quantity}
                              onChange={(e) => updateProductDetail(pd.id, 'quantity', Number(e.target.value))}
                              className="w-20 h-8"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.strength}
                              onChange={(e) => updateProductDetail(pd.id, 'strength', Number(e.target.value))}
                              className="w-20 h-8"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.price}
                              onChange={(e) => updateProductDetail(pd.id, 'price', Number(e.target.value))}
                              className="w-24 h-8"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">{pd.total.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            <Select value={pd.level} onValueChange={(v) => updateProductDetail(pd.id, 'level', v)}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getProductLevels(pd.product).map(l => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Select value={pd.specs || 'Regular'} onValueChange={(v) => updateProductDetail(pd.id, 'specs', v)}>
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getProductSpecs(pd.product).map(spec => (
                                  <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductDetail(pd.id)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setProductDialogOpen(false)}>
              Done ({productDetails.length} products)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

