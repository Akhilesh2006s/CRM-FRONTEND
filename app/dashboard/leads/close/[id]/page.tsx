'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, X } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { normalizeProductTerm, persistProductTerm, termFromLevelLabel } from '@/lib/productTerm'
import { partitionProductsForCloseLeadRouting } from '@/lib/closeLeadTermRouting'
import {
  type ProductDetailRow,
  productDetailsToSections,
} from '@/lib/closeLeadProductConfig'
import { useCloseLeadProductConfig } from '@/hooks/useCloseLeadProductConfig'
import { CloseLeadProductConfig } from '@/components/leads/CloseLeadProductConfig'

type Lead = {
  _id: string
  dc_code?: string
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
  products?: any[] | string
  priority?: string
  remarks?: string
  school_type?: string
  school_code?: string
}


const getCurrentAcademicYear = () => {
  const currentYear = new Date().getFullYear()
  return `${currentYear}-${currentYear + 1}`
}

export default function CloseLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  const currentAcademicYear = getCurrentAcademicYear()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  /** True when the record was loaded from /dc-orders (not /leads). */
  const [isDcOrderRecord, setIsDcOrderRecord] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    contact_person2: '',
    contact_mobile2: '',
    delivery_date: '',
    year: currentAcademicYear,
  })
  
  const [poPhoto, setPoPhoto] = useState<File | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState<string>('')
  const [uploadingPO, setUploadingPO] = useState(false)
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitPreview, setSplitPreview] = useState<{
    term1: { productName: string; strength: number }[]
    term2: { productName: string; strength: number }[]
  } | null>(null)
  const [pendingSubmissionContext, setPendingSubmissionContext] = useState<{
    dcProductDetails: any[]
    totalQuantity: number
  } | null>(null)

  const productConfig = useCloseLeadProductConfig({ schoolType: lead?.school_type })
  const {
    productDetails,
    setProductSections,
    childProductRows,
    groupedChildProductRows,
    availableProducts,
    getDefaultLevel,
    getProductSpecs,
    getProductCategories,
    hasProductCategories,
    validateProducts,
    buildDcOrderProducts,
  } = productConfig

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
        setIsDcOrderRecord(true)
      } catch {
        // If not found, try leads API
        leadData = await apiRequest<any>(`/leads/${leadId}`)
        setIsDcOrderRecord(false)
      }
      
      if (leadData) {
        setLead(leadData)
        // Pre-fill form with lead data
        // Only use estimated_delivery_date, NOT follow_up_date
        const deliveryDate = leadData.estimated_delivery_date 
          ? new Date(leadData.estimated_delivery_date).toISOString().split('T')[0]
          : ''
        setForm({
          contact_person2: leadData.decision_maker || leadData.contact_person2 || leadData.contact_person || '',
          contact_mobile2: leadData.contact_mobile2 || '',
                delivery_date: deliveryDate, // Do NOT use follow_up_date here
                year: currentAcademicYear,
        })
        
        // Pre-fill selected products and product details - normalize product names to match availableProducts
        // Only set products that exactly match availableProducts
        let validProducts: string[] = []
        
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
        if (validProducts.length > 0) {
          const parentRows: ProductDetailRow[] = validProducts.map((product, productIdx) => {
            const productData = leadData.products?.find((p: any) => 
              (p.product_name || p.product || p) === product
            )
            // Load saved quantity and unit_price if available
            const savedQuantity = productData?.quantity || 0
            const savedUnitPrice = productData?.unit_price || 0
            
            return {
              id: Date.now().toString() + productIdx,
              product: product,
              class: '1',
              fromClass: productData?.fromClass || productData?.class || '1',
              toClass: productData?.toClass || '10',
              category: hasProductCategories(product)
                ? (getProductCategories(product)[0] || '')
                : (leadData.school_type === 'Existing' ? 'Existing Students' : 'New Students'),
              quantity: savedQuantity || 1,
              strength: savedQuantity || 0, // Use saved quantity as default strength
              price: savedUnitPrice || 0, // Use saved unit_price as default price
              total: (savedQuantity || 0) * (savedUnitPrice || 0),
              level: productData?.level || getDefaultLevel(product),
              specs: getProductSpecs(product)[0] || '',
              isParentRow: true,
              sameRateForAllClasses: false,
              selectedSubjects: [],
              selectedSpecs: getProductSpecs(product).slice(0, 1),
              selectedDeliverables: productData?.deliverables || [],
              selectedCategories: hasProductCategories(product) 
                ? getProductCategories(product) 
                : undefined,
              term: normalizeProductTerm(productData?.term),
            }
          })
          setProductSections(productDetailsToSections(parentRows))
        } else {
          setProductSections([])
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead')
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  // Get products that were selected when the lead was created (from "Products Interested")
  const getLeadProducts = (): string[] => {
    if (!lead?.products) {
      return []
    }
    
    let productNames: string[] = []
    
    // Handle array format
    if (Array.isArray(lead.products) && lead.products.length > 0) {
      productNames = lead.products.map((p: any) => {
        const name = p.product_name || p.product || p
        return typeof name === 'string' ? name.trim() : null
      }).filter((name: string | null): name is string => name !== null)
    } 
    // Handle string format (comma-separated)
    else if (typeof lead.products === 'string' && lead.products.trim()) {
      productNames = lead.products.split(',').map((p: string) => p.trim()).filter(Boolean)
    }
    
    if (productNames.length === 0) {
      return []
    }
    
    // Normalize product names to match availableProducts
    return productNames
      .map((name: string) => {
        const normalized = name.trim()
        // Map variations to exact names (same normalization as in loadLead)
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
      .filter((name: string) => {
        return name !== null && availableProducts.includes(name)
      })
  }

  const handlePOPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type - only allow PDFs
    const isValidType = file.type === 'application/pdf'
    if (!isValidType) {
      toast.error('Please upload a PDF file only')
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

  const proceedWithSubmission = async (dcProductDetails: any[], totalQuantity: number) => {
    try {
      // Create DC with all details
      const assignedEmployeeId = currentUser?._id

      const dcPayload: any = {
        dcOrderId: leadId,
        dcDate: form.delivery_date || new Date().toISOString(),
        dcRemarks: `Lead converted to client - ${lead?.school_name}`,
        dcCategory: lead?.school_type === 'Existing' ? 'Existing School' : 'New School',
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
      
      const leadIdForDc = leadId

      const dc = await apiRequest('/dc/raise', {
        method: 'POST',
        body: JSON.stringify({
          ...dcPayload,
          dcOrderId: leadIdForDc,
        }),
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
    } finally {
      setSubmitting(false)
    }
  }

  const handleSplitConfirm = async () => {
    if (!pendingSubmissionContext) return
    setSubmitting(true)
    setSplitModalOpen(false)
    setSplitPreview(null)
    await proceedWithSubmission(
      pendingSubmissionContext.dcProductDetails,
      pendingSubmissionContext.totalQuantity
    )
    setPendingSubmissionContext(null)
  }

  const handleSplitCancel = () => {
    setSplitModalOpen(false)
    setSplitPreview(null)
    setPendingSubmissionContext(null)
    setSubmitting(false)
  }

  const handleTurnToClient = async () => {
    if (!lead) return
    
    const productValidation = validateProducts()
    if (!productValidation.ok) {
      toast.error(productValidation.message)
      return
    }

    const actualProductDetails = childProductRows
    const groupedProductDetails = groupedChildProductRows
    
    // Validate delivery date is required
    if (!form.delivery_date || form.delivery_date.trim() === '') {
      toast.error('Delivery date is required')
      return
    }
    
    // Validate PO document is required
    if (!poPhotoUrl || poPhotoUrl.trim() === '') {
      toast.error('PO document is required. Please upload a PDF file.')
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
      
      // Determine if this is a DC Order or Lead based on what was loaded
      // (dc_code alone is unreliable — Super Admin Create Sale orders often have no dc_code yet)
      const isDcOrder = isDcOrderRecord
      
      // Prepare update payload
      const updatePayload: any = {
        school_name: lead?.school_name || undefined,
        contact_person: lead?.contact_person || undefined,
        contact_mobile: lead?.contact_mobile || undefined,
        email: lead?.email || undefined,
        contact_person2: form.contact_person2 || undefined, // Decision Maker name
        contact_mobile2: form.contact_mobile2 || undefined, // Decision Maker mobile
        decision_maker: form.contact_person2 || undefined, // Also set decision_maker field
        estimated_delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
        year: currentAcademicYear,
        assigned_to: assignedEmployeeId,
        products: buildDcOrderProducts(),
      }
      
      // Update the lead/dc-order with appropriate status
      console.log('🔄 Updating with payload:', {
        leadId,
        type: isDcOrder ? 'DcOrder' : 'Lead',
        assigned_to: updatePayload.assigned_to,
        hasProducts: !!updatePayload.products
      });
      
      try {
        if (isDcOrder) {
          // DC Order status enum: 'saved', 'pending', 'in_transit', 'completed', 'hold', ...
          // Use 'saved' so the record appears in Executive My Clients (same as convert-to-client).
          updatePayload.status = 'saved'
          
          const updated = await apiRequest(`/dc-orders/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          })
          console.log('✅ DcOrder updated successfully:', {
            id: updated._id,
            status: updated.status,
            assigned_to: updated.assigned_to
          });
          
          // Also create/update Lead record with Closed status for reporting
          try {
            // Try to find existing lead by school name and mobile
            const searchResponse = await apiRequest<any>(`/leads?schoolName=${encodeURIComponent(lead?.school_name || '')}&contactMobile=${lead?.contact_mobile || ''}`)
            const allLeads = Array.isArray(searchResponse) ? searchResponse : (searchResponse?.data || [])
            const existingLead = allLeads.find((l: any) => 
              l.school_name === lead?.school_name && 
              l.contact_mobile === lead?.contact_mobile
            )
            
            const clientSchoolCode =
              updated.school_code || lead?.school_code || ''
            if (existingLead) {
              // Update existing lead to Closed
              await apiRequest(`/leads/${existingLead._id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  status: 'Closed',
                  year: currentAcademicYear,
                  ...(clientSchoolCode ? { school_code: clientSchoolCode } : {}),
                  school_id: updated._id,
                }),
              })
              console.log('✅ Lead record updated to Closed for reporting')
            } else {
              // Create new lead record for reporting
              await apiRequest('/leads/create', {
                method: 'POST',
                body: JSON.stringify({
                  school_name: lead?.school_name || updated.school_name,
                  school_code: clientSchoolCode || undefined,
                  school_id: updated._id,
                  contact_person: lead?.contact_person || updated.contact_person,
                  contact_mobile: lead?.contact_mobile || updated.contact_mobile,
                  email: lead?.email || updated.email || undefined,
                  zone: lead?.zone || updated.zone,
                  location: lead?.location || updated.location,
                  priority: lead?.priority || updated.priority || 'Hot',
                  year: currentAcademicYear,
                  status: 'Closed',
                  createdBy: assignedEmployeeId,
                }),
              })
              console.log('✅ Lead record created with Closed status for reporting')
            }
          } catch (leadUpdateErr: any) {
            console.warn('⚠️ Could not update/create Lead record for reporting:', leadUpdateErr?.message)
            // Don't fail the whole operation - DC Order update succeeded
          }
        } else {
          // Lead status enum: 'Pending', 'Processing', 'Saved', 'Closed'
          updatePayload.status = 'Closed' // Use 'Closed' for Leads
          
          const updated = await apiRequest(`/leads/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          })
          console.log('✅ Lead updated successfully:', {
            id: updated._id,
            status: updated.status
          });
        }
      } catch (err: any) {
        console.error('❌ Update failed:', err);
        throw err; // Re-throw to be caught by outer catch
      }
      
      // Prepare product details for DC (exclude parent rows).
      // We send the FULL list of spec rows so Client DC can show all specs/levels,
      // but requestedQuantity (below) is based on groupedProductDetails so total strength
      // is still per class, not multiplied by specs.
      const dcProductDetails = actualProductDetails.map(p => {
        const parentRow = productDetails.find(parent => parent.isParentRow && p.id.startsWith(parent.id + '_'))
        const deliverables = parentRow?.selectedDeliverables || []
        const levelValue = p.level || getDefaultLevel(p.product)
        const levelKey = (levelValue || '').toString().toLowerCase().replace(/\s+/g, '')
        let termFromLevel: string | null = null
        if (levelKey.startsWith('term2')) termFromLevel = 'Term 2'
        else if (levelKey.startsWith('term1')) termFromLevel = 'Term 1'
        else if (levelKey.includes('both')) termFromLevel = 'Both'
        const skuCats = hasProductCategories(p.product) ? getProductCategories(p.product) : []
        const catStr = typeof p.category === 'string' ? p.category.trim() : ''
        const isSkuCategory = skuCats.some((c) => c.toLowerCase() === catStr.toLowerCase())
        const enrollmentCategory =
          lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students'
        return {
          product: p.product,
          class: p.class || '1', // Use actual class value
          category: isSkuCategory
            ? enrollmentCategory
            : p.category ||
              (hasProductCategories(p.product)
                ? getProductCategories(p.product)[0] || enrollmentCategory
                : enrollmentCategory),
          productCategory: isSkuCategory
            ? catStr
            : (p as any).productCategory || undefined,
          quantity: Number(p.quantity) || 0, // Keep for backend compatibility
          strength: Number(p.strength) || 0,
          price: Number(p.price) || 0,
          total: Number(p.total) || (Number(p.strength) || 0) * (Number(p.price) || 0),
          level: levelValue,
          specs: p.specs || '',
          subject: p.subject || undefined, // Include subject if present
          deliverables,
          term: persistProductTerm({
            term: (p as any).term || (parentRow as any)?.term,
            level: levelValue,
          }),
        }
      })
      
      // Total requested quantity is based on groupedProductDetails (per product + class),
      // so having multiple specs for the same class does NOT multiply the strength.
      const totalQuantity = groupedProductDetails.reduce((sum, p) => sum + (p.strength || 0), 0)

      // Group by product: Term/Level 2 → Term-Wise only when same product also has Term/Level 1.
      const { myClientsProducts, termWiseProducts, needsTermWiseSplit } =
        partitionProductsForCloseLeadRouting(dcProductDetails)

      if (needsTermWiseSplit) {
        setSubmitting(false)
        setSplitPreview({
          term1: myClientsProducts.map((p: any) => ({
            productName: `${p.productName || p.product}${p.level ? ` (${p.level})` : p.term ? ` (${p.term})` : ''}`,
            strength: p.strength || p.quantity || 0,
          })),
          term2: termWiseProducts.map((p: any) => ({
            productName: `${p.productName || p.product}${p.level ? ` (${p.level})` : p.term ? ` (${p.term})` : ''}`,
            strength: p.strength || p.quantity || 0,
          })),
        })
        setPendingSubmissionContext({ dcProductDetails, totalQuantity })
        setSplitModalOpen(true)
        return
      }

      await proceedWithSubmission(dcProductDetails, totalQuantity)
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client')
      toast.error(err?.message || 'Failed to convert lead to client')
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
          {/* School Name */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">School Name</Label>
            <Input
              value={lead?.school_name || ''}
              onChange={(e) => setLead(lead ? { ...lead, school_name: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Person 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Person 1</Label>
            <Input
              value={lead?.contact_person || ''}
              onChange={(e) => setLead(lead ? { ...lead, contact_person: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Email 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Email 1</Label>
            <Input
              type="email"
              value={lead?.email || ''}
              onChange={(e) => setLead(lead ? { ...lead, email: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Mob 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Mob 1</Label>
            <Input
              value={lead?.contact_mobile || ''}
              onChange={(e) => setLead(lead ? { ...lead, contact_mobile: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Decision Maker Name */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Decision Maker Name</Label>
            <Input
              value={form.contact_person2}
              onChange={(e) => setForm({ ...form, contact_person2: e.target.value })}
              placeholder="Enter decision maker name"
              className="mt-1"
            />
          </div>

          {/* Decision Maker Mobile Number */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Decision Maker Mobile Number</Label>
            <Input
              value={form.contact_mobile2}
              onChange={(e) => setForm({ ...form, contact_mobile2: e.target.value })}
              placeholder="Enter decision maker mobile"
              className="mt-1"
            />
          </div>

          {/* Delivery Date */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Delivery Date *</Label>
            <Input
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              className="mt-1"
              required
            />
          </div>

          {/* Select Year */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Select Year</Label>
            <Input
              value={form.year}
              readOnly
              className="mt-1 bg-neutral-100 cursor-not-allowed"
            />
          </div>

          {/* PO Document Upload */}
          <div className="pt-4 border-t">
            <Label className="text-sm font-semibold text-neutral-700">PO Document *</Label>
            <div className="mt-1 space-y-2">
              {poPhotoUrl ? (
                <div className="flex items-center gap-2">
                  <div className="h-20 w-20 flex items-center justify-center bg-red-100 rounded border">
                    <span className="text-xs font-semibold text-red-700">PDF</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={resolveUploadUrl(poPhotoUrl)}
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
                    accept="application/pdf"
                    onChange={handlePOPhotoUpload}
                    disabled={uploadingPO}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-1">Accepted: PDF only (max 5MB)</p>
                  {uploadingPO && <p className="text-xs text-neutral-500 mt-1">Uploading...</p>}
                </div>
              )}
            </div>
          </div>

          {/* Add Products (shared Close Lead product config) */}
          <CloseLeadProductConfig config={productConfig} schoolType={lead?.school_type} />

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

      {/* Split Confirmation Dialog */}
      <Dialog
        open={splitModalOpen}
        onOpenChange={(open) => {
          if (!open) handleSplitCancel()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>This lead will be split into 2 DCs</DialogTitle>
            <DialogDescription>
              Review how products will be divided before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* DC 1 */}
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold mb-2 text-green-700">
                DC 1 – My Clients (Term 1)
              </p>
              <ul className="space-y-1">
                {splitPreview?.term1.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>• {p.productName}</span>
                    <span>Qty: {p.strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DC 2 */}
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold mb-2 text-blue-700">
                DC 2 – Term Wise DC (Term 2)
              </p>
              <ul className="space-y-1">
                {splitPreview?.term2.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>• {p.productName}</span>
                    <span>Qty: {p.strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleSplitCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSplitConfirm}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

