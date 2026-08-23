'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Eye, Search, X } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { Badge } from '@/components/ui/badge'
import { sortDcsNewestFirst } from '@/lib/dcListSort'

type DC = {
  _id: string
  dc_code?: string
  dcDate?: string
  createdAt?: string
  customerName?: string
  dcOrderId?: {
    _id: string
    school_name?: string
    zone?: string
  } | string
  zone?: string
  dcCategory?: string
  status?: string
  productDetails?: Array<{
    product?: string
    quantity?: number
    strength?: number
  }>
  employeeId?: {
    _id: string
    name?: string
    email?: string
  } | string
}

const DC_STATUSES = [
  'created',
  'po_submitted',
  'sent_to_manager',
  'pending_dc',
  'warehouse_processing',
  'completed',
  'hold',
  'scheduled_for_later',
]

const DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

export default function SearchDCPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProducts } = useProducts()
  
  const [selectedSchool, setSelectedSchool] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedDCCategory, setSelectedDCCategory] = useState<string>('')
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [schools, setSchools] = useState<string[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [dcs, setDcs] = useState<DC[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  // Check if user is Admin
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Access denied. Admin only.')
      router.push('/dashboard')
      return
    }
  }, [isAdmin, router])

  // Load all DCs to get unique schools and zones
  useEffect(() => {
    if (isAdmin) {
      loadAllDCs()
    }
  }, [isAdmin])

  const loadAllDCs = async () => {
    try {
      const data = await apiRequest<DC[]>('/dc')
      const dcArray = Array.isArray(data) ? data : []
      setDcs(dcArray)
      
      // Extract unique schools
      const uniqueSchools = new Set<string>()
      const uniqueZones = new Set<string>()
      
      dcArray.forEach((dc) => {
        const schoolName = typeof dc.dcOrderId === 'object' && dc.dcOrderId?.school_name
          ? dc.dcOrderId.school_name
          : dc.customerName || ''
        if (schoolName) uniqueSchools.add(schoolName)
        
        const zone = typeof dc.dcOrderId === 'object' && dc.dcOrderId?.zone
          ? dc.dcOrderId.zone
          : dc.zone || ''
        if (zone) uniqueZones.add(zone)
      })
      
      setSchools(Array.from(uniqueSchools).sort())
      setZones(Array.from(uniqueZones).sort())
    } catch (error: any) {
      console.error('Error loading DCs:', error)
    }
  }

  const handleSearch = async () => {
    // Check if at least one filter is selected
    const hasFilters = selectedSchool || selectedDate || selectedProduct || selectedStatus || selectedDCCategory || selectedZone
    
    if (!hasFilters) {
      toast.error('Please select at least one filter')
      return
    }

    setSearching(true)
    try {
      let queryParams = new URLSearchParams()
      
      // Apply all selected filters
      if (selectedSchool) {
        queryParams.append('schoolName', selectedSchool)
      }
      
      if (selectedDate) {
        queryParams.append('fromDate', selectedDate)
        queryParams.append('toDate', selectedDate)
      }
      
      if (selectedStatus) {
        queryParams.append('status', selectedStatus)
      }
      
      if (selectedDCCategory) {
        queryParams.append('visitCategory', selectedDCCategory)
      }
      
      if (selectedZone) {
        queryParams.append('zone', selectedZone)
      }

      // Fetch DCs with API filters
      const data = await apiRequest<DC[]>(`/dc?${queryParams.toString()}`)
      let filteredDCs = Array.isArray(data) ? data : []

      // Additional client-side filtering for Product (not supported by API directly)
      if (selectedProduct) {
        filteredDCs = filteredDCs.filter((dc) => {
          if (dc.productDetails && Array.isArray(dc.productDetails)) {
            return dc.productDetails.some((pd) => 
              (pd.product || '').toLowerCase().includes(selectedProduct.toLowerCase())
            )
          }
          return false
        })
      }

      setDcs(sortDcsNewestFirst(filteredDCs))
      toast.success(`Found ${filteredDCs.length} DC(s)`)
    } catch (error: any) {
      console.error('Error searching DCs:', error)
      toast.error(error?.message || 'Failed to search DCs')
      setDcs([])
    } finally {
      setSearching(false)
    }
  }

  const handleClear = () => {
    setSelectedSchool('')
    setSelectedDate('')
    setSelectedProduct('')
    setSelectedStatus('')
    setSelectedDCCategory('')
    setSelectedZone('')
    setDcs([])
  }

  const clearFilter = (filterType: 'school' | 'date' | 'product' | 'status' | 'dcCategory' | 'zone') => {
    switch (filterType) {
      case 'school':
        setSelectedSchool('')
        break
      case 'date':
        setSelectedDate('')
        break
      case 'product':
        setSelectedProduct('')
        break
      case 'status':
        setSelectedStatus('')
        break
      case 'dcCategory':
        setSelectedDCCategory('')
        break
      case 'zone':
        setSelectedZone('')
        break
    }
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (selectedSchool) count++
    if (selectedDate) count++
    if (selectedProduct) count++
    if (selectedStatus) count++
    if (selectedDCCategory) count++
    if (selectedZone) count++
    return count
  }

  const getDCNumber = (dc: DC) => {
    if (dc.dc_code) return dc.dc_code
    if (typeof dc.dcOrderId === 'object' && dc.dcOrderId?.dc_code) {
      return dc.dcOrderId.dc_code
    }
    return `DC-${dc._id.slice(-6)}`
  }

  const getSchoolName = (dc: DC) => {
    if (typeof dc.dcOrderId === 'object' && dc.dcOrderId?.school_name) {
      return dc.dcOrderId.school_name
    }
    return dc.customerName || '-'
  }

  const getZone = (dc: DC) => {
    if (typeof dc.dcOrderId === 'object' && dc.dcOrderId?.zone) {
      return dc.dcOrderId.zone
    }
    return dc.zone || '-'
  }

  const getTotalItems = (dc: DC) => {
    if (dc.productDetails && Array.isArray(dc.productDetails)) {
      return dc.productDetails.reduce((sum, pd) => {
        return sum + (pd.strength || pd.quantity || 0)
      }, 0)
    }
    return 0
  }

  const getCreatedBy = (dc: DC) => {
    if (typeof dc.employeeId === 'object' && dc.employeeId?.name) {
      return dc.employeeId.name
    }
    return '-'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      return '-'
    }
  }

  const formatStatus = (status?: string) => {
    if (!status) return '-'
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Search DC</h1>
          <p className="text-sm text-neutral-600 mt-1">Search and filter Delivery Challans</p>
        </div>
      </div>

      <Card className="p-6 rounded-lg border border-neutral-200">
        <div className="space-y-4">
          {/* Active Filters Display */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">Active Filters:</span>
              {selectedSchool && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>School: {selectedSchool}</span>
                  <button
                    onClick={() => clearFilter('school')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedDate && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>Date: {selectedDate}</span>
                  <button
                    onClick={() => clearFilter('date')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedProduct && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>Product: {selectedProduct}</span>
                  <button
                    onClick={() => clearFilter('product')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedStatus && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>Status: {formatStatus(selectedStatus)}</span>
                  <button
                    onClick={() => clearFilter('status')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedDCCategory && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>DC Category: {selectedDCCategory}</span>
                  <button
                    onClick={() => clearFilter('dcCategory')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
              {selectedZone && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span>Zone: {selectedZone}</span>
                  <button
                    onClick={() => clearFilter('zone')}
                    className="ml-1 hover:text-blue-600 cursor-pointer"
                    type="button"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}

          {/* All Filter Inputs - Always Visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* School Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">School</Label>
              <div className="flex gap-2">
                <Select value={selectedSchool || undefined} onValueChange={setSelectedSchool}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select school (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school} value={school}>
                        {school}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSchool && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSchool('')}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
                placeholder="Select date (optional)"
                allowPastDates
              />
            </div>

            {/* Product Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">Product</Label>
              <div className="flex gap-2">
                <Select value={selectedProduct || undefined} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select product (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProduct('')}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">Status</Label>
              <div className="flex gap-2">
                <Select value={selectedStatus || undefined} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {DC_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatStatus(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedStatus && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedStatus('')}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* DC Category Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">DC Category</Label>
              <div className="flex gap-2">
                <Select value={selectedDCCategory || undefined} onValueChange={setSelectedDCCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select DC category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {DC_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDCCategory && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDCCategory('')}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Zone Filter */}
            <div>
              <Label className="text-sm font-semibold text-neutral-700 mb-2 block">Zone</Label>
              <div className="flex gap-2">
                <Select value={selectedZone || undefined} onValueChange={setSelectedZone}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select zone (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedZone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedZone('')}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button 
              onClick={handleSearch} 
              disabled={searching || getActiveFiltersCount() === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={searching || getActiveFiltersCount() === 0}
            >
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </Card>

      {/* Results Table */}
      {dcs.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="bg-neutral-100 px-4 py-3 border-b">
            <div className="text-neutral-900 font-semibold">Search Results ({dcs.length})</div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>DC Number</TableHead>
                  <TableHead>DC Date</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>DC Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Items</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dcs.map((dc, idx) => (
                  <TableRow key={dc._id}>
                    <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{getDCNumber(dc)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(dc.dcDate || dc.createdAt)}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{getSchoolName(dc)}</TableCell>
                    <TableCell className="whitespace-nowrap">{getZone(dc)}</TableCell>
                    <TableCell className="whitespace-nowrap">{dc.dcCategory || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatStatus(dc.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{getTotalItems(dc)}</TableCell>
                    <TableCell className="whitespace-nowrap">{getCreatedBy(dc)}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/warehouse/dc-at-warehouse/${dc._id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View DC
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {dcs.length === 0 && !loading && getActiveFiltersCount() > 0 && !searching && (
        <Card className="p-6 text-center text-neutral-500">
          No DCs found. Try adjusting your filters.
        </Card>
      )}
    </div>
  )
}
