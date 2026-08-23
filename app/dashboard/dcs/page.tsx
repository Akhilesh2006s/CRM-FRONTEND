'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'
import { Building2, Package, Search, Truck, User, MapPin, Phone, DollarSign } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type VendorDC = {
  _id: string
  dcDate: string
  status: string
  school: {
    _id: string
    name: string
    code: string
    zone: string
    location: string
    contactPerson: string
    contactMobile: string
    dcCode: string
  }
  employee: {
    name: string
    email: string
  } | null
  products: Array<{
    productName: string
    quantity: number
    unitPrice: number
    price: number
    isEnterprise: boolean
  }>
  totalQuantity: number
  totalPrice: number
}

export default function VendorDCsPage() {
  const [dcs, setDcs] = useState<VendorDC[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState<string>('all')

  useEffect(() => {
    const loadDCs = async () => {
      setLoading(true)
      try {
        const data = await apiRequest<VendorDC[]>('/vendor-user/dcs')
        setDcs(Array.isArray(data) ? data : [])
      } catch (err: any) {
        console.error('Failed to load DCs:', err)
        setDcs([])
      } finally {
        setLoading(false)
      }
    }
    loadDCs()
  }, [])

  // Get unique values for filters
  const uniqueZones = useMemo(() => {
    const zones = new Set<string>()
    dcs.forEach(dc => {
      if (dc.school.zone && dc.school.zone !== '-') {
        zones.add(dc.school.zone)
      }
    })
    return Array.from(zones).sort()
  }, [dcs])

  const uniqueProducts = useMemo(() => {
    const products = new Set<string>()
    dcs.forEach(dc => {
      dc.products.forEach(p => products.add(p.productName))
    })
    return Array.from(products).sort()
  }, [dcs])

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>()
    dcs.forEach(dc => statuses.add(dc.status))
    return Array.from(statuses).sort()
  }, [dcs])

  // Filter DCs
  const filteredDCs = useMemo(() => {
    return dcs.filter(dc => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchesSearch = 
          dc.school.name.toLowerCase().includes(search) ||
          dc.school.code.toLowerCase().includes(search) ||
          dc.school.dcCode.toLowerCase().includes(search) ||
          dc.school.contactPerson.toLowerCase().includes(search) ||
          dc.school.contactMobile.includes(search) ||
          dc.products.some(p => p.productName.toLowerCase().includes(search)) ||
          (dc.employee && dc.employee.name.toLowerCase().includes(search))
        
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && dc.status !== statusFilter) {
        return false
      }

      // Zone filter
      if (zoneFilter !== 'all' && dc.school.zone !== zoneFilter) {
        return false
      }

      // Product filter
      if (productFilter !== 'all' && !dc.products.some(p => p.productName === productFilter)) {
        return false
      }

      return true
    })
  }, [dcs, searchTerm, statusFilter, zoneFilter, productFilter])

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'pending_dc': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'scheduled_for_later': 'bg-blue-100 text-blue-800 border-blue-200',
      'submitted_to_warehouse': 'bg-purple-100 text-purple-800 border-purple-200',
      'in_transit': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'hold': 'bg-red-100 text-red-800 border-red-200',
    }
    const color = statusColors[status] || 'bg-neutral-100 text-neutral-800 border-neutral-200'
    return (
      <Badge variant="outline" className={color}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <div className="text-center text-neutral-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading DCs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My DCs</h1>
        <p className="text-sm text-neutral-600 mt-1">View all delivery challans with schools and products</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Search schools, codes, products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {uniqueZones.map(zone => (
                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {uniqueProducts.map(product => (
                <SelectItem key={product} value={product}>{product}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total DCs</p>
              <p className="text-2xl font-semibold text-neutral-900">{filteredDCs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Unique Schools</p>
              <p className="text-2xl font-semibold text-neutral-900">
                {new Set(filteredDCs.map(dc => dc.school._id)).size}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total Quantity</p>
              <p className="text-2xl font-semibold text-neutral-900">
                {filteredDCs.reduce((sum, dc) => sum + dc.totalQuantity, 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-600">Total Price</p>
              <p className="text-2xl font-semibold text-neutral-900">
                ₹{filteredDCs.reduce((sum, dc) => sum + (dc.totalPrice || 0), 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* DCs Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DC Date</TableHead>
                <TableHead>DC Code</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDCs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-neutral-500">
                    No DCs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDCs.map((dc) => (
                  <TableRow key={dc._id}>
                    <TableCell>
                      {dc.dcDate ? new Date(dc.dcDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {dc.school.dcCode || '-'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-neutral-500" />
                          <span className="font-medium">{dc.school.name}</span>
                        </div>
                        {dc.school.code !== '-' && (
                          <span className="text-xs text-neutral-500">Code: {dc.school.code}</span>
                        )}
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <MapPin className="w-3 h-3" />
                          <span>{dc.school.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Phone className="w-3 h-3" />
                          <span>{dc.school.contactMobile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <User className="w-3 h-3" />
                          <span>{dc.school.contactPerson}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{dc.school.zone}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {dc.products.map((product, idx) => (
                          <div key={idx} className="text-sm">
                            {product.productName} · Qty {product.quantity} · Unit ₹{product.unitPrice.toLocaleString('en-IN')} · ₹{product.price.toLocaleString('en-IN')}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{dc.totalQuantity}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-semibold text-lg text-emerald-700">
                          ₹{dc.totalPrice.toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {dc.products.some(p => p.isEnterprise) && (
                            <span className="text-blue-600">Includes enterprise pricing</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {dc.employee ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-neutral-500" />
                            <span className="text-sm">{dc.employee.name}</span>
                          </div>
                          <span className="text-xs text-neutral-500">{dc.employee.email}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(dc.status)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
