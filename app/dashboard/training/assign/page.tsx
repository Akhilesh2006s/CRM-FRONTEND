'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { ArrowUpDown } from 'lucide-react'

type School = {
  _id: string
  school_code?: string
  school_name?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  location?: string
  zone?: string
  products?: Array<{ product_name: string }> | string[]
  assigned_to?: {
    _id: string
    name?: string
  }
  created_at?: string
  createdAt?: string
}

type Trainer = { _id: string; name: string; trainerProducts?: string[] }
type Employee = { _id: string; name: string }

export default function AssignTrainingServicePage() {
  const router = useRouter()
  const [schools, setSchools] = useState<School[]>([])
  const [trainers, setTrainers] = useState<Trainer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Filters
  const [filters, setFilters] = useState({
    schoolCode: '',
    schoolName: '',
    mobile: '',
    town: '',
    fromDate: '',
    toDate: '',
    executive: '',
    zone: '',
  })
  
  // Dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
  const [assignType, setAssignType] = useState<'training' | 'service'>('training')
  const [assignForm, setAssignForm] = useState({
    subject: '',
    trainerId: '',
    employeeId: '',
    date: '',
    term: '',
    trainingLevel: '',
    remarks: '',
    status: 'Scheduled' as 'Scheduled' | 'Completed' | 'Cancelled',
  })
  
  // Sorting
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch zones and executives from schools data
  const zones = useMemo(() => {
    const uniqueZones = [...new Set(schools.map(s => s.zone).filter(Boolean) as string[])]
    return uniqueZones.sort()
  }, [schools])

  const executives = useMemo(() => {
    const uniqueExecs = [...new Set(schools.map(s => s.assigned_to?.name).filter(Boolean) as string[])]
    return uniqueExecs.sort()
  }, [schools])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch from completed DCs
      const [completedDCsRes, tData, eData] = await Promise.all([
        apiRequest<any[]>('/dc/completed'),
        apiRequest<Trainer[]>('/trainers?isActive=true'),
        apiRequest<Employee[]>('/employees?isActive=true'),
      ])

      const completedDCs = Array.isArray(completedDCsRes) ? completedDCsRes : []
      const schoolMap = new Map<string, School>()

      // Process completed DCs
      completedDCs.forEach((dc: any) => {
        // Extract school information from dcOrderId (populated) or use direct fields
        const dcOrder = dc.dcOrderId || {}
        const schoolName = dcOrder.school_name || dc.customerName || ''
        const schoolCode = dcOrder.dc_code || dcOrder.school_code || ''
        const key = schoolName || schoolCode || dc._id

        if (key && !schoolMap.has(key)) {
          // Extract products from dcOrder or product field
          let products: any[] = []
          if (dcOrder.products && Array.isArray(dcOrder.products)) {
            products = dcOrder.products
          } else if (dc.product) {
            products = Array.isArray(dc.product) ? dc.product : [dc.product]
          }

          // Extract assigned_to from employeeId
          const assigned_to = dc.employeeId ? {
            _id: dc.employeeId._id || dc.employeeId,
            name: dc.employeeId.name || ''
          } : undefined

          schoolMap.set(key, {
            _id: dc._id,
            school_code: schoolCode,
            school_name: schoolName,
            school_type: dcOrder.school_type || 'Existing',
            contact_person: dcOrder.contact_person || '',
            contact_mobile: dcOrder.contact_mobile || dc.customerPhone || '',
            location: dcOrder.location || dcOrder.address || dc.customerAddress || '',
            zone: dcOrder.zone || '',
            products: products,
            assigned_to: assigned_to,
            created_at: dc.completedAt || dc.createdAt,
          })
        }
      })

      setSchools(Array.from(schoolMap.values()))
      // Ensure trainers are properly loaded from database
      const trainersList = Array.isArray(tData) ? tData : []
      setTrainers(trainersList)
      console.log(`Loaded ${trainersList.length} trainers from database`)
      setEmployees(Array.isArray(eData) ? eData : [])
    } catch (e) {
      console.error('Failed to load data:', e)
      toast.error('Failed to load data')
      setSchools([])
      setTrainers([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSchools = useMemo(() => {
    let filtered = [...schools]

    if (filters.schoolCode) {
      filtered = filtered.filter(s => 
        (s.school_code || '').toLowerCase().includes(filters.schoolCode.toLowerCase())
      )
    }
    if (filters.schoolName) {
      filtered = filtered.filter(s => 
        (s.school_name || '').toLowerCase().includes(filters.schoolName.toLowerCase())
      )
    }
    if (filters.mobile) {
      filtered = filtered.filter(s => 
        (s.contact_mobile || '').includes(filters.mobile)
      )
    }
    if (filters.town) {
      filtered = filtered.filter(s => 
        (s.location || '').toLowerCase().includes(filters.town.toLowerCase())
      )
    }
    if (filters.executive) {
      filtered = filtered.filter(s => 
        s.assigned_to?.name === filters.executive
      )
    }
    if (filters.zone) {
      filtered = filtered.filter(s => s.zone === filters.zone)
    }
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate)
      filtered = filtered.filter(s => {
        const schoolDate = s.created_at ? new Date(s.created_at) : new Date(0)
        return schoolDate >= fromDate
      })
    }
    if (filters.toDate) {
      const toDate = new Date(filters.toDate)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(s => {
        const schoolDate = s.created_at ? new Date(s.created_at) : new Date(0)
        return schoolDate <= toDate
      })
    }

    // Sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        let aVal: any = ''
        let bVal: any = ''

        switch (sortBy) {
          case 'schoolCode':
            aVal = (a.school_code || '').toLowerCase()
            bVal = (b.school_code || '').toLowerCase()
            break
          case 'schoolName':
            aVal = (a.school_name || '').toLowerCase()
            bVal = (b.school_name || '').toLowerCase()
            break
          case 'contactName':
            aVal = (a.contact_person || '').toLowerCase()
            bVal = (b.contact_person || '').toLowerCase()
            break
          case 'mobile':
            aVal = a.contact_mobile || ''
            bVal = b.contact_mobile || ''
            break
          case 'executive':
            aVal = (a.assigned_to?.name || '').toLowerCase()
            bVal = (b.assigned_to?.name || '').toLowerCase()
            break
          case 'location':
            aVal = (a.location || '').toLowerCase()
            bVal = (b.location || '').toLowerCase()
            break
          default:
            return 0
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [schools, filters, sortBy, sortOrder])

  const paginatedSchools = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredSchools.slice(start, start + itemsPerPage)
  }, [filteredSchools, currentPage])

  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage)

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleAssignClick = (school: School, type: 'training' | 'service') => {
    setSelectedSchool(school)
    setAssignType(type)
    setAssignForm({
      subject: '',
      trainerId: '',
      employeeId: school.assigned_to?._id || '',
      date: '',
      term: '',
      trainingLevel: '',
      remarks: '',
      status: 'Scheduled',
    })
    setAssignDialogOpen(true)
  }

  const handleAssignSubmit = async () => {
    if (!selectedSchool) return

    if (assignType === 'training') {
      // For training, validate required fields: Product, Trainer, Term, Training Date, Training Level
      if (!assignForm.subject || !assignForm.trainerId || !assignForm.date || !assignForm.term || !assignForm.trainingLevel) {
        toast.error('Please fill all required fields')
        return
      }
    } else {
      // For service, validate: Product, Trainer, Term, Service Date
      if (!assignForm.subject || !assignForm.trainerId || !assignForm.date || !assignForm.term) {
        toast.error('Please fill all required fields')
        return
      }
    }

    setSubmitting(true)
    try {
      const endpoint = assignType === 'training' ? '/training/create' : '/services/create'
      const payload: any = {
        schoolName: selectedSchool.school_name || '',
        zone: selectedSchool.zone || '',
        town: selectedSchool.location || '',
        subject: assignForm.subject,
        trainerId: assignForm.trainerId,
        [assignType === 'training' ? 'trainingDate' : 'serviceDate']: assignForm.date,
        status: assignForm.status,
      }
      
      // Only include schoolCode if it exists and is not empty
      if (selectedSchool.school_code && selectedSchool.school_code.trim()) {
        payload.schoolCode = selectedSchool.school_code.trim()
      }
      
      // Only include employeeId if it exists
      if (assignForm.employeeId) {
        payload.employeeId = assignForm.employeeId
      }
      
      // For training, include term, trainingLevel, and remarks
      if (assignType === 'training') {
        if (assignForm.term) payload.term = assignForm.term
        if (assignForm.trainingLevel) payload.trainingLevel = assignForm.trainingLevel
        if (assignForm.remarks) payload.remarks = assignForm.remarks
      } else {
        // For service, include term and remarks
        if (assignForm.term) payload.term = assignForm.term
        if (assignForm.remarks) payload.remarks = assignForm.remarks
      }
      
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) })
      toast.success(`${assignType === 'training' ? 'Training' : 'Service'} assigned successfully`)
      setAssignDialogOpen(false)
      setSelectedSchool(null)
      // Optionally reload data or navigate
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign')
    } finally {
      setSubmitting(false)
    }
  }

  // Show all active trainers from database (no filtering by subject)
  const filteredTrainers = useMemo(() => {
    return trainers // Show all active trainers
  }, [trainers])

  const exportToExcel = () => {
    const headers = ['S.No', 'School Code', 'School Type', 'School Name', 'Contact Name', 'Mobile', 'Products', 'Executive', 'Location']
    const rows: string[][] = []

    filteredSchools.forEach((school, index) => {
      const products = Array.isArray(school.products)
        ? school.products.map((p: any) => typeof p === 'string' ? p : p.product_name).join(',')
        : ''
      
      rows.push([
        (index + 1).toString(),
        school.school_code || '',
        school.school_type || 'Existing',
        school.school_name || '',
        school.contact_person || '',
        school.contact_mobile || '',
        products,
        school.assigned_to?.name || '',
        school.location || '',
      ])
    })

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `existing-schools-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 mb-2">Viswam Edutech - Existing Schools List</h1>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-neutral-700">Existing Schools</h2>
          <Button onClick={exportToExcel}>Export to Excel</Button>
        </div>
      </div>

      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); setCurrentPage(1) }} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Code</label>
            <Input
              className="bg-white text-neutral-900"
              placeholder="School Code"
              value={filters.schoolCode}
              onChange={(e) => setFilters(f => ({ ...f, schoolCode: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input
              className="bg-white text-neutral-900"
              placeholder="School Name"
              value={filters.schoolName}
              onChange={(e) => setFilters(f => ({ ...f, schoolName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Mobile No</label>
            <Input
              className="bg-white text-neutral-900"
              placeholder="Mobile No"
              value={filters.mobile}
              onChange={(e) => setFilters(f => ({ ...f, mobile: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Town</label>
            <Input
              className="bg-white text-neutral-900"
              placeholder="Town"
              value={filters.town}
              onChange={(e) => setFilters(f => ({ ...f, town: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">From Date</label>
            <Input
              type="date"
              className="bg-white text-neutral-900"
              placeholder="dd-mm-yyyy"
              value={filters.fromDate}
              onChange={(e) => setFilters(f => ({ ...f, fromDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">To Date</label>
            <Input
              type="date"
              className="bg-white text-neutral-900"
              placeholder="dd-mm-yyyy"
              value={filters.toDate}
              onChange={(e) => setFilters(f => ({ ...f, toDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Executive</label>
            <Select value={filters.executive || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, executive: v === 'all' ? '' : v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Executive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Executives</SelectItem>
                {executives.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Select Zone</label>
            <Select value={filters.zone || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, zone: v === 'all' ? '' : v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(z => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Button type="submit" className="w-full md:w-auto">Search</Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && filteredSchools.length === 0 && (
          <div className="p-4 text-center text-neutral-500">No schools found</div>
        )}
        {!loading && filteredSchools.length > 0 && (
          <>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-sky-50/70 border-b text-neutral-700">
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('sno')} className="flex items-center gap-1 hover:underline">
                      S.No <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('schoolCode')} className="flex items-center gap-1 hover:underline">
                      School Code <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">School Type</th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('schoolName')} className="flex items-center gap-1 hover:underline">
                      School Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('contactName')} className="flex items-center gap-1 hover:underline">
                      Contact Name <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('mobile')} className="flex items-center gap-1 hover:underline">
                      Mobile <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">Products</th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('executive')} className="flex items-center gap-1 hover:underline">
                      Executive <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">
                    <button onClick={() => toggleSort('location')} className="flex items-center gap-1 hover:underline">
                      Location <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2 px-3 text-left border">Action 1</th>
                  <th className="py-2 px-3 text-left border">Action 2</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSchools.map((school, index) => {
                  const products = Array.isArray(school.products)
                    ? school.products.map((p: any) => typeof p === 'string' ? p : p.product_name).join(',')
                    : ''
                  const location = school.location || ''
                  const fullLocation = school.school_name ? `${school.school_name}, ${location}` : location
                  
                  return (
                    <tr key={school._id} className="border-b last:border-0 hover:bg-neutral-50">
                      <td className="py-2 px-3 border">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className="py-2 px-3 border">{school.school_code || '-'}</td>
                      <td className="py-2 px-3 border">
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          {school.school_type || 'Existing'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border font-medium">{school.school_name || '-'}</td>
                      <td className="py-2 px-3 border">{school.contact_person || '-'}</td>
                      <td className="py-2 px-3 border">{school.contact_mobile || '-'}</td>
                      <td className="py-2 px-3 border text-xs">{products || '-'}</td>
                      <td className="py-2 px-3 border">{school.assigned_to?.name || '-'}</td>
                      <td className="py-2 px-3 border text-xs">{fullLocation || '-'}</td>
                      <td className="py-2 px-3 border">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-orange-500 text-white hover:bg-orange-600 border-orange-500"
                          onClick={() => handleAssignClick(school, 'training')}
                        >
                          Training
                        </Button>
                      </td>
                      <td className="py-2 px-3 border">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAssignClick(school, 'service')}
                        >
                          Service
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="p-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{assignType === 'training' ? 'Add Training Schedule Details' : 'Add Service Schedule Details'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Select value={assignForm.subject} onValueChange={(v) => setAssignForm(f => ({ ...f, subject: v }))}>
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Abacus">Abacus</SelectItem>
                  <SelectItem value="Vedic Maths">Vedic Maths</SelectItem>
                  <SelectItem value="EEL">EEL</SelectItem>
                  <SelectItem value="IIT">IIT</SelectItem>
                  <SelectItem value="Financial literacy">Financial literacy</SelectItem>
                  <SelectItem value="Brain bytes">Brain bytes</SelectItem>
                  <SelectItem value="Spelling bee">Spelling bee</SelectItem>
                  <SelectItem value="Skill pro">Skill pro</SelectItem>
                  <SelectItem value="Maths lab">Maths lab</SelectItem>
                  <SelectItem value="Codechamp">Codechamp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trainer *</Label>
              <Select
                value={assignForm.trainerId}
                onValueChange={(v) => setAssignForm(f => ({ ...f, trainerId: v }))}
              >
                <SelectTrigger className="bg-white text-neutral-900">
                  <SelectValue placeholder="Select Trainer" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(filteredTrainers) && filteredTrainers.length > 0 ? (
                    filteredTrainers.map(t => (
                      <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-trainers" disabled>No trainers available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {assignType === 'training' && (
              <>
                <div>
                  <Label>Term *</Label>
                  <Select value={assignForm.term} onValueChange={(v) => setAssignForm(f => ({ ...f, term: v }))}>
                    <SelectTrigger className="bg-white text-neutral-900">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1">Term 1</SelectItem>
                      <SelectItem value="Term 2">Term 2</SelectItem>
                      <SelectItem value="Term 3">Term 3</SelectItem>
                      <SelectItem value="Term 4">Term 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Training Date *</Label>
                  <Input
                    type="date"
                    className="bg-white text-neutral-900"
                    value={assignForm.date}
                    onChange={(e) => setAssignForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Training Level *</Label>
                  <Input
                    type="text"
                    className="bg-white text-neutral-900"
                    value={assignForm.trainingLevel}
                    onChange={(e) => setAssignForm(f => ({ ...f, trainingLevel: e.target.value }))}
                    placeholder="Enter training level"
                    required
                  />
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Input
                    type="text"
                    className="bg-white text-neutral-900"
                    value={assignForm.remarks}
                    onChange={(e) => setAssignForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Enter remarks (optional)"
                  />
                </div>
              </>
            )}
            {assignType === 'service' && (
              <>
                <div>
                  <Label>Term *</Label>
                  <Select value={assignForm.term} onValueChange={(v) => setAssignForm(f => ({ ...f, term: v }))}>
                    <SelectTrigger className="bg-white text-neutral-900">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1">Term 1</SelectItem>
                      <SelectItem value="Term 2">Term 2</SelectItem>
                      <SelectItem value="Term 3">Term 3</SelectItem>
                      <SelectItem value="Term 4">Term 4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Date *</Label>
                  <Input
                    type="date"
                    className="bg-white text-neutral-900"
                    value={assignForm.date}
                    onChange={(e) => setAssignForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Remarks</Label>
                  <Input
                    type="text"
                    className="bg-white text-neutral-900"
                    value={assignForm.remarks}
                    onChange={(e) => setAssignForm(f => ({ ...f, remarks: e.target.value }))}
                    placeholder="Enter remarks (optional)"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignSubmit} disabled={submitting}>
              {submitting ? 'Assigning...' : assignType === 'training' ? 'Add Training' : 'Add Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
