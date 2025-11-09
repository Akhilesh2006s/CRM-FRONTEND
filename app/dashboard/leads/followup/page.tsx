'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, MapPin, Edit, History, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Lead = { 
  _id: string
  school_name?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  status?: string
  priority?: string
  follow_up_date?: string
  location?: string
  strength?: number
  createdAt?: string
  remarks?: string
  school_type?: string
}

export default function FollowupLeadsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<string[]>([])
  
  // Filters
  const [zone, setZone] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  
  // Update Lead Modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    status: '',
    remarks: '',
  })
  const [updating, setUpdating] = useState(false)
  
  // View History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyLead, setHistoryLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allLeads, zone, schoolName, contactMobile])

  const loadLeads = async () => {
    setLoading(true)
    try {
      if (!currentUser?._id) {
        toast.error('User not found')
        return
      }

      // Fetch leads assigned to current employee
      const allData = await apiRequest<Lead[]>(`/leads?employee=${currentUser._id}`)
      
      // Filter out closed/saved/completed leads from allData as well
      const activeLeads = (allData || []).filter((lead: Lead) => {
        const status = lead.status?.toLowerCase()
        return status !== 'saved' && status !== 'completed' && status !== 'closed'
      })
      
      // Also fetch from dc-orders
      const dcOrders = await apiRequest<any[]>(`/dc-orders?assigned_to=${currentUser._id}`)
      
      // Convert dc-orders to lead format and exclude closed/saved leads
      const leadsFromOrders: Lead[] = dcOrders
        .filter((order: any) => {
          // Exclude leads that are closed/saved/completed
          const status = order.status?.toLowerCase()
          return status !== 'saved' && status !== 'completed' && status !== 'closed'
        })
        .map((order: any) => ({
          _id: order._id,
          school_name: order.school_name,
          contact_person: order.contact_person,
          contact_mobile: order.contact_mobile,
          zone: order.zone,
          status: order.status,
          follow_up_date: order.follow_up_date || order.estimated_delivery_date,
          location: order.location,
          strength: order.strength,
          createdAt: order.createdAt,
          remarks: order.remarks,
          school_type: order.school_type,
          priority: order.priority || order.lead_status || 'Cold',
        }))
      
      // Combine and filter followup leads
      const combinedLeads = [...activeLeads, ...leadsFromOrders]
      
      // Filter leads that need follow-up - exclude closed/saved/completed leads
      const followUpLeads = combinedLeads.filter((lead: Lead) => {
        const status = lead.status?.toLowerCase()
        // Exclude closed/saved/completed leads
        if (status === 'saved' || status === 'completed' || status === 'closed') {
          return false
        }
        // Include pending/processing leads or leads with future follow-up dates
        return (
          status === 'pending' ||
          status === 'processing' ||
          (lead.follow_up_date && new Date(lead.follow_up_date) >= new Date())
        )
      })
      
      // Remove duplicates by _id
      const uniqueLeads = followUpLeads.filter((lead, index, self) =>
        index === self.findIndex((l) => l._id === lead._id)
      )
      
      setAllLeads(uniqueLeads)
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(uniqueLeads.map(l => l.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
    } catch (err: any) {
      toast.error('Failed to load followup leads')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allLeads]

    if (zone && zone !== 'all') filtered = filtered.filter(l => l.zone?.toLowerCase().includes(zone.toLowerCase()))
    if (contactMobile) filtered = filtered.filter(l => l.contact_mobile?.includes(contactMobile))
    if (schoolName) filtered = filtered.filter(l => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()))

    setLeads(filtered)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-orange-100 text-orange-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const openUpdateModal = (lead: Lead) => {
    setSelectedLead(lead)
    setUpdateForm({
      follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date).toISOString().split('T')[0] : '',
      status: lead.priority || 'Cold',
      remarks: lead.remarks || '',
    })
    setUpdateModalOpen(true)
  }

  const closeUpdateModal = () => {
    setUpdateModalOpen(false)
    setSelectedLead(null)
    setUpdateForm({ follow_up_date: '', status: '', remarks: '' })
  }

  const handleUpdateLead = async () => {
    if (!selectedLead) return
    
    // Validate that at least one field is being updated
    if (!updateForm.follow_up_date && !updateForm.remarks && !updateForm.status) {
      toast.error('Please fill at least one field to update')
      return
    }
    
    setUpdating(true)
    try {
      const payload: any = {}
      
      // Only include fields that have values
      if (updateForm.follow_up_date) {
        payload.follow_up_date = new Date(updateForm.follow_up_date).toISOString()
      }
      if (updateForm.status) {
        payload.priority = updateForm.status
      }
      if (updateForm.remarks !== undefined) {
        payload.remarks = updateForm.remarks
      }
      
      console.log('Updating lead with payload:', payload)
      
      // Try to update via dc-orders API first (since that's where history is tracked)
      let updated = false
      try {
        const response = await apiRequest(`/dc-orders/${selectedLead._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        console.log('Update response:', response)
        updated = true
      } catch (err: any) {
        console.log('dc-orders update failed, trying leads API:', err?.message)
        // If not found in dc-orders, try leads API
        try {
          await apiRequest(`/leads/${selectedLead._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
          updated = true
        } catch (leadErr: any) {
          console.error('Both update attempts failed:', leadErr)
          throw leadErr
        }
      }
      
      if (updated) {
        toast.success('Lead updated successfully!')
        closeUpdateModal()
        // Reload leads to get updated data
        await loadLeads()
      }
    } catch (err: any) {
      console.error('Update error:', err)
      toast.error(err?.message || 'Failed to update lead')
    } finally {
      setUpdating(false)
    }
  }

  const openHistoryModal = async (lead: Lead) => {
    setHistoryLead(lead)
    setHistoryModalOpen(true)
    setHistory([])
    
    // Fetch update history from API
    try {
      let historyData: any[] = []
      
      // Try to get history from dc-orders API first
      try {
        console.log('Fetching history for lead:', lead._id)
        const apiHistory = await apiRequest<any[]>(`/dc-orders/${lead._id}/history`)
        console.log('API response:', apiHistory)
        
        if (apiHistory && Array.isArray(apiHistory)) {
          historyData = apiHistory
          console.log('Fetched history from API:', historyData.length, 'entries')
          
          // Log each entry for debugging
          historyData.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, {
              date: entry.updatedAt,
              priority: entry.priority,
              remarks: entry.remarks,
              followUp: entry.follow_up_date,
            })
          })
        } else {
          console.log('API returned non-array or empty:', apiHistory)
        }
      } catch (err: any) {
        console.error('Error fetching history from dc-orders:', err)
        console.log('Error details:', err?.message, err?.response)
        // If not found in dc-orders, try leads API (though it doesn't have history)
      }
      
      // Also try to get the full lead data which might have history embedded
      try {
        const fullLeadData = await apiRequest<any>(`/dc-orders/${lead._id}`)
        console.log('Full lead data:', fullLeadData)
        if (fullLeadData?.updateHistory && Array.isArray(fullLeadData.updateHistory)) {
          console.log('Found history in full lead data:', fullLeadData.updateHistory.length, 'entries')
          // Merge with existing history, avoiding duplicates
          const existingDates = new Set(historyData.map(h => new Date(h.updatedAt).getTime()))
          fullLeadData.updateHistory.forEach((entry: any) => {
            const entryDate = new Date(entry.updatedAt).getTime()
            if (!existingDates.has(entryDate)) {
              historyData.push(entry)
              existingDates.add(entryDate)
            }
          })
        }
      } catch (err: any) {
        console.log('Could not fetch full lead data:', err?.message)
      }
      
      // If no history from API, add creation entry from current lead data
      if (historyData.length === 0 && lead.createdAt) {
        console.log('No history found, adding creation entry')
        historyData.push({
          follow_up_date: lead.follow_up_date || null,
          remarks: lead.remarks || 'Lead created',
          priority: lead.priority || 'Cold',
          updatedAt: lead.createdAt,
          updatedBy: { name: 'System' },
        })
      }
      
      // Sort by date descending (newest first)
      historyData.sort((a, b) => {
        const dateA = new Date(a.updatedAt || 0).getTime()
        const dateB = new Date(b.updatedAt || 0).getTime()
        return dateB - dateA
      })
      
      console.log('Final history data:', historyData.length, 'entries')
      setHistory(historyData)
    } catch (err: any) {
      console.error('Failed to load history:', err)
      // Even on error, show current lead data as history
      if (lead.createdAt) {
        setHistory([{
          follow_up_date: lead.follow_up_date || null,
          remarks: lead.remarks || 'Lead created',
          priority: lead.priority || 'Cold',
          updatedAt: lead.createdAt,
          updatedBy: { name: 'System' },
        }])
      } else {
        setHistory([])
      }
    }
  }

  const closeHistoryModal = () => {
    setHistoryModalOpen(false)
    setHistoryLead(null)
    setHistory([])
  }

  const handleEditDetails = (lead: Lead) => {
    // Navigate to edit page or open edit modal
    // For now, we'll navigate to a edit page
    router.push(`/dashboard/leads/edit/${lead._id}`)
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
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Followup Leads</h1>
          <p className="text-sm text-neutral-600 mt-1">View and manage your followup leads</p>
        </div>
      </div>

      <Card className="p-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Zone</label>
            <Select value={zone || undefined} onValueChange={(v) => setZone(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones
                  .filter(z => z && z.trim() !== '')
                  .map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input
              placeholder="Search school..."
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Contact Mobile</label>
            <Input
              placeholder="Search mobile..."
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={loadLeads} className="w-full">
              Refresh
            </Button>
          </div>
        </div>

        {/* Lead Cards */}
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading followup leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {allLeads.length === 0 
              ? 'No followup leads found. Create leads to see them here.'
              : 'No leads match the current filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card key={lead._id} className="p-5 border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header with School Name and Location */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-orange-600 mb-1">
                        {lead.school_name || 'Unnamed School'}
                      </h3>
                      {lead.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-600">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span>{lead.location}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600 hover:text-purple-700"
                      onClick={() => {
                        router.push(`/dashboard/leads/close/${lead._id}`)
                      }}
                    >
                      Close Lead
                    </Button>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-600">Contact:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_person || '-'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Mobile:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_mobile || '-'}</span>
                    </div>
                  </div>

                  {/* Lead Details */}
                  <div className="space-y-2 text-sm">
                    {lead.remarks && (
                      <div>
                        <span className="text-neutral-600">Remarks:</span>
                        <span className="ml-2 text-neutral-900">{lead.remarks}</span>
                      </div>
                    )}
                    {lead.follow_up_date && (
                      <div>
                        <span className="text-neutral-600">Follow Up Date:</span>
                        <span className={`ml-2 font-medium ${
                          new Date(lead.follow_up_date) < new Date() ? 'text-red-600' : 'text-neutral-900'
                        }`}>
                          {formatDateTime(lead.follow_up_date)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-600">Lead Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPriorityColor(lead.priority)}`}>
                        {lead.priority || 'Cold'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      onClick={() => handleEditDetails(lead)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                      onClick={() => openUpdateModal(lead)}
                    >
                      Update Lead
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={() => openHistoryModal(lead)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      View History
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Update Lead Modal - Modern Professional Design */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden shadow-2xl border-0">
          {/* Elegant Header with Gradient */}
          <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-5">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-white text-xl font-semibold tracking-tight">
                Update Follow-up
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-sm">
                Record your interaction and schedule the next follow-up
              </DialogDescription>
            </DialogHeader>
          </div>
          
          {/* Form Content with Professional Spacing */}
          <div className="px-6 py-6 bg-gradient-to-b from-white to-neutral-50">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Next Follow-up Date
                </Label>
                <Input
                  type="date"
                  className="h-11 bg-white border-neutral-300 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                  value={updateForm.follow_up_date}
                  onChange={(e) => setUpdateForm({ ...updateForm, follow_up_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Lead Priority
                </Label>
                <Select 
                  value={updateForm.status} 
                  onValueChange={(v) => setUpdateForm({ ...updateForm, status: v })}
                >
                  <SelectTrigger className="h-11 bg-white border-neutral-300 focus:border-purple-500 focus:ring-purple-500/20">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hot" className="focus:bg-red-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Hot
                      </span>
                    </SelectItem>
                    <SelectItem value="Warm" className="focus:bg-orange-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        Warm
                      </span>
                    </SelectItem>
                    <SelectItem value="Cold" className="focus:bg-blue-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Cold
                      </span>
                    </SelectItem>
                    <SelectItem value="Dropped" className="focus:bg-gray-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                        Dropped
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Remarks
                </Label>
                <Textarea
                  className="min-h-[100px] bg-white border-neutral-300 focus:border-purple-500 focus:ring-purple-500/20 resize-none transition-all"
                  placeholder="Enter your remarks about this interaction..."
                  value={updateForm.remarks}
                  onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-neutral-500">Provide details about your conversation or next steps</p>
              </div>
            </div>
          </div>
          
          {/* Professional Footer */}
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={closeUpdateModal}
              className="border-neutral-300 hover:bg-neutral-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateLead} 
              disabled={updating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 px-6"
            >
              {updating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                'Save Update'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View History Modal - Modern Professional Design */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden p-0 gap-0 shadow-2xl border-0">
          {/* Elegant Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-white text-xl font-semibold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Update History
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  Complete timeline of all interactions and updates
                </DialogDescription>
              </DialogHeader>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-blue-800/50 h-8 w-8 p-0 rounded-full"
                onClick={closeHistoryModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* History Content with Timeline Design */}
          <div className="overflow-y-auto max-h-[calc(85vh-140px)] bg-gradient-to-b from-white via-neutral-50/50 to-white">
            {history.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <History className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No History Yet</h3>
                <p className="text-sm text-neutral-600 max-w-sm mx-auto">
                  Update history will appear here once you start recording follow-ups and interactions.
                </p>
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-blue-200"></div>
                  
                  {/* History Items */}
                  <div className="space-y-6">
                    {history.map((item, index) => {
                      // Use a unique key for each entry
                      const entryKey = item._id || item.updatedAt || `entry-${index}`;
                      const priority = item.priority || 'Cold'
                      const priorityColors = {
                        Hot: 'bg-red-100 text-red-700 border-red-200',
                        Warm: 'bg-orange-100 text-orange-700 border-orange-200',
                        Cold: 'bg-blue-100 text-blue-700 border-blue-200',
                        Dropped: 'bg-gray-100 text-gray-700 border-gray-200',
                      }
                      const priorityDotColors = {
                        Hot: 'bg-red-500 ring-red-200',
                        Warm: 'bg-orange-500 ring-orange-200',
                        Cold: 'bg-blue-500 ring-blue-200',
                        Dropped: 'bg-gray-500 ring-gray-200',
                      }
                      
                      return (
                        <div key={entryKey} className="relative pl-12">
                          {/* Timeline Dot */}
                          <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full ${priorityDotColors[priority as keyof typeof priorityDotColors] || priorityDotColors.Cold} ring-4 ring-white flex items-center justify-center shadow-lg`}>
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                          
                          {/* History Card */}
                          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm hover:shadow-md transition-shadow p-5">
                            {/* Header with Date and Priority */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    {formatDateTime(item.updatedAt)}
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityColors[priority as keyof typeof priorityColors] || priorityColors.Cold}`}>
                                    {priority}
                                  </span>
                                </div>
                                {item.updatedBy?.name && (
                                  <p className="text-xs text-neutral-500">
                                    Updated by <span className="font-medium text-neutral-700">{item.updatedBy.name}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Follow-up Date */}
                            {item.follow_up_date && (
                              <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-100">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm font-medium text-blue-900">
                                    Next Follow-up: {formatDateTime(item.follow_up_date)}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Remarks */}
                            {item.remarks && (
                              <div className="mt-3">
                                <div className="flex items-start gap-2">
                                  <svg className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap flex-1">
                                    {item.remarks}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Professional Footer */}
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 sticky bottom-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                {history.length > 0 ? `${history.length} ${history.length === 1 ? 'update' : 'updates'} recorded` : 'No updates yet'}
              </p>
              <Button 
                variant="outline" 
                onClick={closeHistoryModal}
                className="border-neutral-300 hover:bg-white"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

