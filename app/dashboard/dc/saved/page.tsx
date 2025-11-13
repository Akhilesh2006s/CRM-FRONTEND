'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'

type DcOrder = {
  _id: string
  dc_code?: string
  school_name?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  cluster?: string
  products?: Array<{ product_name: string; quantity: number }>
  assigned_to?: {
    _id: string
    name?: string
    email?: string
  }
  created_at?: string
  createdAt?: string
  remarks?: string
}

type DC = {
  _id: string
  dcOrderId?: string | DcOrder
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  dcNotes?: string
  productDetails?: Array<{
    product: string
    class: string
    category: string
    productName: string
    quantity: number
    strength?: number
  }>
}

export default function SavedDCPage() {
  const [items, setItems] = useState<DcOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<DcOrder | null>(null)
  const [openRaiseDCDialog, setOpenRaiseDCDialog] = useState(false)
  const [openLocationDialog, setOpenLocationDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  // Map to store existing DCs: dealId -> DC
  const [dealDCs, setDealDCs] = useState<Record<string, DC>>({})
  const [existingDC, setExistingDC] = useState<DC | null>(null)

  // Roles
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isSuperAdmin = currentUser?.role === 'Super Admin'
  const isCoordinator = currentUser?.role === 'Coordinator'
  const isEmployee = currentUser?.role === 'Executive'
  const canUpdateDC = isSuperAdmin || isCoordinator || isEmployee

  // Form state for Raise DC modal
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  
  // Product rows for DC (like in the Raise DC form)
  type ProductRow = {
    id: string
    product: string
    class: string
    category: string
    productName: string
    quantity: number
    strength?: number
  }
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { id: '1', product: 'Abacus', class: '1', category: 'New Students', productName: '', quantity: 0, strength: 0 }
  ])

  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const availableCategories = ['New Students', 'Existing Students', 'Both']
  const { productNames: availableProducts } = useProducts()

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<DcOrder[]>(`/dc-orders?status=saved`)
      // Ensure data is an array before using array methods
      const dataArray = Array.isArray(data) ? data : []

      // Load existing DCs for all deals with poPhotoUrl
      const dcMap: Record<string, DC> = {}
      try {
        const allDealIds = dataArray.map((d: any) => d._id)
        for (const dealId of allDealIds) {
          try {
            const dcs = await apiRequest<DC[]>(`/dc?dcOrderId=${dealId}`)
            if (dcs && dcs.length > 0) {
              // Get the DC with poPhotoUrl if available
              const dcWithPO = dcs.find(dc => dc.poPhotoUrl) || dcs[0]
              dcMap[dealId] = dcWithPO
            }
          } catch (_) {}
        }
        setDealDCs(dcMap)
      } catch (_) {}

      setItems(dataArray as any)
    } catch (_) {}
    setLoading(false)
  }

  useEffect(() => {
    load()
    // employees
    const loadEmployees = async () => {
      try {
        const data = await apiRequest<any[]>('/employees?isActive=true')
        const list = Array.isArray(data) ? data : []
        setEmployees(list.map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' })).filter(e => e.name !== 'Unknown'))
      } catch (_) {}
    }
    loadEmployees()
  }, [])

  const openRaiseDC = async (deal: DcOrder) => {
    try {
      // Check if DC already exists for this deal
      const existingDCForDeal = dealDCs[deal._id]
      setExistingDC(existingDCForDeal || null)
      
      // Fetch full deal details to ensure all data is populated
      const fullDeal = await apiRequest<DcOrder>(`/dc-orders/${deal._id}`)
      
      // Handle assigned_to - could be ObjectId string, populated object, or null/undefined
      let assignedTo = undefined
      
      // First check the fullDeal from API
      if (fullDeal.assigned_to) {
        if (typeof fullDeal.assigned_to === 'object' && fullDeal.assigned_to !== null && '_id' in fullDeal.assigned_to) {
          // Already populated object with _id
          if ('name' in fullDeal.assigned_to && fullDeal.assigned_to.name) {
            assignedTo = fullDeal.assigned_to
          } else {
            // Has _id but no name - might need to use from deal list
            assignedTo = deal.assigned_to || fullDeal.assigned_to
          }
        } else if (typeof fullDeal.assigned_to === 'string') {
          // It's an ObjectId string - try to get from the deal list (which should be populated)
          assignedTo = deal.assigned_to || { _id: fullDeal.assigned_to as string, name: 'Unknown' }
        }
      }
      
      // Fallback to deal's assigned_to from the list (which should be populated)
      if (!assignedTo && deal.assigned_to) {
        if (typeof deal.assigned_to === 'object' && deal.assigned_to !== null && '_id' in deal.assigned_to) {
          assignedTo = deal.assigned_to
        }
      }
      
      // Normalize the deal data
      const normalizedDeal: DcOrder = {
        ...fullDeal,
        school_name: fullDeal.school_name || deal.school_name || '',
        school_type: fullDeal.school_type || deal.school_type || '',
        contact_person: fullDeal.contact_person || deal.contact_person || '',
        contact_mobile: fullDeal.contact_mobile || deal.contact_mobile || '',
        email: fullDeal.email || deal.email || '',
        address: fullDeal.address || deal.address || deal.location || '',
        location: fullDeal.location || deal.location || deal.address || '',
        zone: fullDeal.zone || deal.zone || '',
        cluster: fullDeal.cluster || deal.cluster || '',
        remarks: fullDeal.remarks || deal.remarks || '',
        dc_code: fullDeal.dc_code || deal.dc_code || '',
        products: fullDeal.products || deal.products || [],
        assigned_to: assignedTo,
      }
      
      setSelectedDeal(normalizedDeal)
      // Set selected employee if already assigned
      if (normalizedDeal.assigned_to && typeof normalizedDeal.assigned_to === 'object' && '_id' in normalizedDeal.assigned_to) {
        setSelectedEmployeeId(normalizedDeal.assigned_to._id)
      } else {
        setSelectedEmployeeId('')
      }
      // If DC exists, load its data; otherwise start fresh
      if (existingDCForDeal) {
        // Load full DC details to get all fields
        try {
          const fullDC = await apiRequest<DC>(`/dc/${existingDCForDeal._id}`)
          
          setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '')
          setDcRemarks(fullDC.dcRemarks || '')
          setDcCategory(fullDC.dcCategory || '')
          setDcNotes(fullDC.dcNotes || '')
          
          // Load product rows from DC productDetails or DcOrder products
          if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
            setProductRows(fullDC.productDetails.map((p, idx) => ({
              id: String(idx + 1),
              product: p.product || 'Abacus',
              class: p.class || '1',
              category: p.category || 'New Students',
              productName: p.productName || '',
              quantity: p.quantity || 0,
              strength: p.strength || 0,
            })))
          } else if (normalizedDeal.products && Array.isArray(normalizedDeal.products) && normalizedDeal.products.length > 0) {
            setProductRows(normalizedDeal.products.map((p: any, idx: number) => ({
              id: String(idx + 1),
              product: p.product_name || 'Abacus',
              class: '1',
              category: 'New Students',
              productName: p.product_name || '',
              quantity: p.quantity || 0,
              strength: p.strength || 0,
            })))
          } else {
            setProductRows([{ id: '1', product: 'Abacus', class: '1', category: 'New Students', productName: '', quantity: 0, strength: 0 }])
          }
        } catch (e) {
          console.error('Failed to load existing DC:', e)
          // Fallback to empty form
          setDcDate('')
          setDcRemarks('')
          setDcCategory('')
          setDcNotes('')
          if (normalizedDeal.products && Array.isArray(normalizedDeal.products) && normalizedDeal.products.length > 0) {
            setProductRows(normalizedDeal.products.map((p: any, idx: number) => ({
              id: String(idx + 1),
              product: p.product_name || 'Abacus',
              class: '1',
              category: 'New Students',
              productName: p.product_name || '',
              quantity: p.quantity || 0,
              strength: p.strength || 0,
            })))
          } else {
            setProductRows([{ id: '1', product: 'Abacus', class: '1', category: 'New Students', productName: '', quantity: 0, strength: 0 }])
          }
        }
      } else {
        // No existing DC, start with fresh form
        setDcDate('')
        setDcRemarks('')
        setDcCategory('')
        setDcNotes('')
        // Initialize product rows from existing products in deal, or start with one empty row
        if (normalizedDeal.products && Array.isArray(normalizedDeal.products) && normalizedDeal.products.length > 0) {
          setProductRows(normalizedDeal.products.map((p: any, idx: number) => ({
            id: String(idx + 1),
            product: p.product_name || 'Abacus',
            class: '1',
            category: 'New Students',
            productName: p.product_name || '',
            quantity: p.quantity || 0,
            strength: p.strength || 0,
          })))
        } else {
          setProductRows([{ id: '1', product: 'Abacus', class: '1', category: 'New Students', productName: '', quantity: 0, strength: 0 }])
        }
      }
      setOpenRaiseDCDialog(true)
    } catch (e: any) {
      console.error('Failed to load full deal details:', e)
      // Fallback to using the deal data we have
      setSelectedDeal(deal)
      setOpenRaiseDCDialog(true)
      alert('Warning: Could not load full deal details. Some fields may be empty.')
    }
  }

  const openViewLocation = (deal: DcOrder) => {
    setSelectedDeal(deal)
    setOpenLocationDialog(true)
  }

  const handleSubmitToSeniorCoordinator = async () => {
    if (!selectedDeal) return

    // Check if employee is assigned - prioritize deal's assigned employee
    let employeeId = null
    
    // First, check if deal already has an assigned employee
    if (selectedDeal.assigned_to) {
      if (typeof selectedDeal.assigned_to === 'object' && '_id' in selectedDeal.assigned_to) {
        employeeId = selectedDeal.assigned_to._id
      } else if (typeof selectedDeal.assigned_to === 'string') {
        employeeId = selectedDeal.assigned_to
      }
    }
    
    // If no employee from deal, use the selected employee from dropdown (only if deal doesn't have one)
    if (!employeeId && selectedEmployeeId) {
      employeeId = selectedEmployeeId
    }

    // Only require employee assignment if deal truly doesn't have one
    if (!employeeId) {
      alert('Please assign an employee before submitting to Senior Coordinator')
      return
    }

    setSubmitting(true)
    try {
      // First, raise DC (creates or gets existing DC)
      const raisePayload: any = {
        dcOrderId: selectedDeal._id,
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcNotes: dcNotes || undefined,
      }
      
      // Only include employeeId if deal doesn't already have one assigned (backend will use deal's assigned_to if available)
      if (!selectedDeal.assigned_to && employeeId) {
        raisePayload.employeeId = employeeId
      }

      // Calculate requested quantity from product rows
      const totalQuantity = productRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
      raisePayload.requestedQuantity = totalQuantity || 1
      
      // Include product details in payload
      raisePayload.productDetails = productRows.map(row => ({
        product: row.product,
        class: row.class,
        category: row.category,
        productName: row.productName,
        quantity: row.quantity,
        strength: row.strength || 0,
      }))

      let dc: DC
      
      // If DC exists, update it; otherwise create new one
      if (existingDC) {
        // Update existing DC
        await apiRequest(`/dc/${existingDC._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...raisePayload,
            financeRemarks: raisePayload.financeRemarks,
            splApproval: raisePayload.splApproval,
            dcDate: raisePayload.dcDate,
            dcRemarks: raisePayload.dcRemarks,
            dcCategory: raisePayload.dcCategory,
            dcNotes: raisePayload.dcNotes,
            productDetails: raisePayload.productDetails,
          }),
        })
        dc = existingDC
      } else {
        // Create new DC
        dc = await apiRequest<DC>(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(raisePayload),
        })
      }

      // Then submit to manager (moves to sent_to_manager, then appears in Pending DC)
      await apiRequest(`/dc/${dc._id}/submit-to-manager`, {
        method: 'POST',
        body: JSON.stringify({
          requestedQuantity: totalQuantity || 1,
          remarks: dcRemarks || dcNotes || undefined,
        }),
      })

      alert(existingDC ? 'DC updated and submitted to Senior Coordinator successfully!' : 'DC created and submitted to Senior Coordinator successfully! It will appear in Pending DC list.')
      setOpenRaiseDCDialog(false)
      // Reload to refresh the DC map
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to submit to Senior Coordinator')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDC = async () => {
    if (!selectedDeal) return

    // Check if employee is assigned - prioritize deal's assigned employee
    let employeeId = null
    
    // First, check if deal already has an assigned employee
    if (selectedDeal.assigned_to) {
      if (typeof selectedDeal.assigned_to === 'object' && '_id' in selectedDeal.assigned_to) {
        employeeId = selectedDeal.assigned_to._id
      } else if (typeof selectedDeal.assigned_to === 'string') {
        employeeId = selectedDeal.assigned_to
      }
    }
    
    // If no employee from deal, use the selected employee from dropdown (only if deal doesn't have one)
    if (!employeeId && selectedEmployeeId) {
      employeeId = selectedEmployeeId
    }

    // Only require employee assignment if deal truly doesn't have one
    if (!employeeId) {
      alert('Please assign an employee before saving DC')
      return
    }

    setSaving(true)
    try {
      // First, raise DC (creates or gets existing DC)
      const raisePayload: any = {
        dcOrderId: selectedDeal._id,
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcNotes: dcNotes || undefined,
      }
      
      // Only include employeeId if deal doesn't already have one assigned (backend will use deal's assigned_to if available)
      if (!selectedDeal.assigned_to && employeeId) {
        raisePayload.employeeId = employeeId
      }

      // Calculate requested quantity from product rows
      const totalQuantity = productRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
      raisePayload.requestedQuantity = totalQuantity || 1
      
      // Include product details in payload
      raisePayload.productDetails = productRows.map(row => ({
        product: row.product,
        class: row.class,
        category: row.category,
        productName: row.productName,
        quantity: row.quantity,
        strength: row.strength || 0,
      }))

      let dc: DC
      
      // If DC exists, update it; otherwise create new one
      if (existingDC) {
        // Update existing DC
        await apiRequest(`/dc/${existingDC._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...raisePayload,
            financeRemarks: raisePayload.financeRemarks,
            splApproval: raisePayload.splApproval,
            dcDate: raisePayload.dcDate,
            dcRemarks: raisePayload.dcRemarks,
            dcCategory: raisePayload.dcCategory,
            dcNotes: raisePayload.dcNotes,
            productDetails: raisePayload.productDetails,
          }),
        })
        dc = existingDC
      } else {
        // Create new DC
        dc = await apiRequest<DC>(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(raisePayload),
        })
      }

      // Update DcOrder status to 'saved' so it appears in Saved DC page
      await apiRequest(`/dc-orders/${selectedDeal._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'saved' }),
      })

      alert(existingDC ? 'DC updated and saved successfully! It will appear in Saved DC page.' : 'DC created and saved successfully! It will appear in Saved DC page.')
      setOpenRaiseDCDialog(false)
      // Reload to refresh the DC map
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to save DC')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-6">Saved DC List</h1>

      <Card className="p-5 shadow-sm border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input placeholder="By School Name" />
          <Input placeholder="By Contact Mobile No" />
          <Input type="date" placeholder="From Date" />
          <Input type="date" placeholder="To Date" />
          <Input placeholder="Select Zone" />
          <Input placeholder="Select Executive" />
          <Input placeholder="By Town" />
          <Button className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm">Search</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto shadow-sm border-slate-200">
        {loading && <div className="p-6 text-slate-600">Loading...</div>}
        {!loading && items.length === 0 && <div className="p-6 text-slate-500">No saved deals found.</div>}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                <th className="py-3 px-4 text-left font-semibold text-sm">Created On</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">School Type</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Zone</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Town</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">School Name</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Executive</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Mobile</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Products</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">PO</th>
                <th className="py-3 px-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
          {items.map((d) => (
                <tr key={d._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 text-slate-700">{d.created_at ? new Date(d.created_at).toLocaleString() : d.createdAt ? new Date(d.createdAt).toLocaleString() : '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.school_type || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.zone || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.location || d.address?.split(',')[0] || '-'}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{d.school_name || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.assigned_to?.name || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.contact_mobile || '-'}</td>
                  <td className="py-3 px-4 text-slate-700 text-xs">{(d.products || []).map(p => `${p.product_name}${p.quantity ? ` - ${p.quantity}` : ''}`).join(', ') || '-'}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      const dc = dealDCs[d._id]
                      const poUrl = dc?.poPhotoUrl || (typeof dc?.dcOrderId === 'object' && dc.dcOrderId && 'poPhotoUrl' in dc.dcOrderId ? (dc.dcOrderId as any).poPhotoUrl : null)
                      
                      if (poUrl) {
                        return (
                          <div className="flex items-center justify-center">
                            <img
                              src={poUrl}
                              alt="PO Document"
                              className="w-14 h-14 object-contain rounded border border-slate-200 cursor-pointer hover:opacity-75 hover:border-slate-400 transition-all shadow-sm bg-white p-1"
                              onClick={() => window.open(poUrl, '_blank')}
                              title="Click to view full size"
                              onError={(e) => {
                                // If image fails to load, show a link instead
                                const target = e.currentTarget
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent) {
                                  const link = document.createElement('a')
                                  link.href = poUrl
                                  link.target = '_blank'
                                  link.className = 'text-xs text-slate-600 hover:text-slate-800 underline'
                                  link.textContent = 'View PO'
                                  parent.appendChild(link)
                                }
                              }}
                            />
                          </div>
                        )
                      } else {
                        return <span className="text-xs text-slate-400">-</span>
                      }
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1.5">
                      {canUpdateDC && (
                        <Button size="sm" className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm" onClick={() => openRaiseDC(d)}>
                          {dealDCs[d._id] ? 'Update DC' : 'Raise DC'}
                        </Button>
                      )}
                      {!isManager && (
                        <Button size="sm" variant="outline" className="border-slate-300 hover:bg-slate-50 text-slate-700" onClick={() => openViewLocation(d)}>
                          View Location
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Raise DC Modal */}
      <Dialog open={openRaiseDCDialog} onOpenChange={setOpenRaiseDCDialog}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-white border-slate-200 shadow-xl">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xl font-semibold">
              Viswam Edutech - {existingDC ? 'Update DC' : 'Raise DC'}
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-1">
              {existingDC ? 'Update DC details and submit to Senior Coordinator' : 'Fill in DC details and submit to Senior Coordinator'}
            </DialogDescription>
          </DialogHeader>
          {selectedDeal ? (
            <div className="space-y-6 py-4">
              {/* Lead Information and More Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Lead Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 text-base border-b border-slate-200 pb-2">Lead Information</h3>
                  <div>
                    <Label>School Type</Label>
                    <Input 
                      value={selectedDeal.school_type || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="School Type"
                    />
                  </div>
                  <div>
                    <Label>School Name</Label>
                    <Input 
                      value={selectedDeal.school_name || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="School Name"
                    />
                  </div>
                  <div>
                    <Label>School Code</Label>
                    <Input 
                      value={selectedDeal.dc_code || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="School Code"
                    />
                  </div>
                  <div>
                    <Label>Contact Person Name</Label>
                    <Input 
                      value={selectedDeal.contact_person || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="Contact Person Name"
                    />
                  </div>
                  <div>
                    <Label>Contact Mobile</Label>
                    <Input 
                      value={selectedDeal.contact_mobile || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="Contact Mobile"
                    />
                  </div>
                  <div>
                    <Label>Assigned To</Label>
                    {(() => {
                      // Check if deal has assigned employee - be more lenient with the check
                      const assignedTo = selectedDeal.assigned_to
                      
                      // Check if we have a valid assigned employee
                      let hasAssignedEmployee = false
                      let employeeName = ''
                      
                      if (assignedTo) {
                        if (typeof assignedTo === 'object' && assignedTo !== null) {
                          // It's an object - check if it has name or _id
                          if ('name' in assignedTo && assignedTo.name) {
                            hasAssignedEmployee = true
                            employeeName = String(assignedTo.name)
                          } else if ('_id' in assignedTo) {
                            // Has _id but might not have name - still consider it assigned
                            hasAssignedEmployee = true
                            employeeName = 'Employee (ID: ' + String(assignedTo._id) + ')'
                          }
                        } else if (typeof assignedTo === 'string') {
                          // It's a string ID - not ideal but if it exists, try to find name
                          hasAssignedEmployee = false // Will show dropdown but pre-select
                        }
                      }
                      
                      if (hasAssignedEmployee && employeeName) {
                        // Show assigned employee name (read-only)
                        return (
                          <Input 
                            value={employeeName} 
                            disabled 
                            className="bg-slate-50 text-slate-900 border-slate-200" 
                            placeholder="Assigned To"
                          />
                        )
                      } else {
                        // Show dropdown if no employee is assigned
                        return (
                          <>
                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} required>
                              <SelectTrigger className="bg-white text-slate-900 border-slate-200">
                                <SelectValue placeholder="Select Employee *" />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.length === 0 ? (
                                  <div className="px-2 py-1.5 text-sm text-slate-500">Loading employees...</div>
                                ) : (
                                  employees.map((emp) => (
                                    <SelectItem key={emp._id} value={emp._id}>
                                      {emp.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            {!selectedEmployeeId && (
                              <p className="text-xs text-red-500 mt-1">Please assign an employee to continue</p>
                            )}
                          </>
                        )
                      }
                    })()}
                  </div>
                </div>

                {/* More Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 text-base border-b border-slate-200 pb-2">More Information</h3>
                  <div>
                    <Label>Town</Label>
                    <Input 
                      value={selectedDeal.location || selectedDeal.address?.split(',')[0] || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="Town"
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea 
                      value={selectedDeal.address || selectedDeal.location || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      rows={3} 
                      placeholder="Address"
                    />
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <Input 
                      value={selectedDeal.zone || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="Zone"
                    />
                  </div>
                  <div>
                    <Label>Cluster</Label>
                    <Input 
                      value={selectedDeal.cluster || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      placeholder="Cluster"
                    />
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <Textarea 
                      value={selectedDeal.remarks || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200" 
                      rows={2} 
                      placeholder="Remarks"
                    />
                  </div>
                </div>
              </div>

              {/* Products Table - Where quantities are added */}
              <div className="border-t border-slate-200 pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-base font-semibold text-slate-900">Products & Quantities</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                    onClick={() => {
                      setProductRows([...productRows, {
                        id: Date.now().toString(),
                        product: 'Abacus',
                        class: '1',
                        category: 'New Students',
                        productName: '',
                        quantity: 0,
                        strength: 0
                      }])
                    }}
                  >
                    (+) Add Row
                  </Button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-800 font-semibold text-xs">Product</th>
                        <th className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-800 font-semibold text-xs">Class</th>
                        <th className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-800 font-semibold text-xs">Category</th>
                        <th className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-800 font-semibold text-xs">Product Name</th>
                        <th className="py-2.5 px-3 text-left border-r border-slate-200 text-slate-800 font-semibold text-xs">Qty</th>
                        <th className="py-2.5 px-3 text-left text-slate-800 font-semibold text-xs">Strength</th>
                        <th className="py-2.5 px-3 text-center text-slate-800 font-semibold text-xs">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((row, idx) => (
                        <tr key={row.id} className="border-b border-slate-100 bg-white hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 px-3 border-r">
                            <Select value={row.product} onValueChange={(v) => {
                              const updated = [...productRows]
                              updated[idx].product = v
                              setProductRows(updated)
                            }}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProducts.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 border-r">
                            <Select value={row.class} onValueChange={(v) => {
                              const updated = [...productRows]
                              updated[idx].class = v
                              setProductRows(updated)
                            }}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableClasses.map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 border-r">
                            <Select value={row.category} onValueChange={(v) => {
                              const updated = [...productRows]
                              updated[idx].category = v
                              setProductRows(updated)
                            }}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCategories.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3 border-r">
                            <Input
                              type="text"
                              className="h-8 text-xs"
                              value={row.productName}
                              onChange={(e) => {
                                const updated = [...productRows]
                                updated[idx].productName = e.target.value
                                setProductRows(updated)
                              }}
                              placeholder="Select Item"
                            />
                          </td>
                          <td className="py-2 px-3 border-r">
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={row.quantity || ''}
                              onChange={(e) => {
                                const updated = [...productRows]
                                updated[idx].quantity = Number(e.target.value) || 0
                                setProductRows(updated)
                              }}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              value={row.strength || ''}
                              onChange={(e) => {
                                const updated = [...productRows]
                                updated[idx].strength = Number(e.target.value) || 0
                                setProductRows(updated)
                              }}
                              placeholder="Enter Strength"
                              min="0"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            {productRows.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => {
                                  setProductRows(productRows.filter((_, i) => i !== idx))
                                }}
                              >
                                ×
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DC Details */}
              <div className="space-y-4 border-t border-slate-200 pt-6 mt-6">
                <h3 className="font-semibold text-slate-900 text-base border-b border-slate-200 pb-2 mb-4">DC Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>DC Date</Label>
                    <Input
                      type="date"
                      value={dcDate}
                      onChange={(e) => setDcDate(e.target.value)}
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                  <div>
                    <Label>DC Category</Label>
                    <Select value={dcCategory} onValueChange={setDcCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select DC Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>DC Remarks</Label>
                    <Input
                      value={dcRemarks}
                      onChange={(e) => setDcRemarks(e.target.value)}
                      placeholder="Remarks"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>DC Notes</Label>
                    <Textarea
                      value={dcNotes}
                      onChange={(e) => setDcNotes(e.target.value)}
                      placeholder="Notes"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center border-t border-slate-200 pt-6 mt-4">
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                    onClick={() => window.print()}
                  >
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                    onClick={async () => {
                      // Save without submitting (optional feature)
                      alert('Save functionality can be implemented to save draft')
                    }}
                  >
                    Save
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
                    onClick={handleSubmitToSeniorCoordinator}
                    disabled={submitting || saving}
                  >
                    {submitting ? 'Submitting...' : 'Submit to Senior Coordinator'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              <p>Loading deal details...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Location Modal */}
      <Dialog open={openLocationDialog} onOpenChange={setOpenLocationDialog}>
        <DialogContent className="sm:max-w-[600px] border-slate-200 shadow-xl">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xl font-semibold">View Location</DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-1">Location details for {selectedDeal?.school_name || 'this deal'}</DialogDescription>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Address</Label>
                <Textarea value={selectedDeal.address || selectedDeal.location || 'N/A'} disabled rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Input value={selectedDeal.zone || '-'} disabled />
                </div>
                <div>
                  <Label>Location/Town</Label>
                  <Input value={selectedDeal.location || '-'} disabled />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm" onClick={() => setOpenLocationDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

