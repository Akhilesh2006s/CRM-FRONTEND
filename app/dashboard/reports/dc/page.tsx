'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { downloadReportFile } from '@/lib/reportDownload'
import { Truck, Search, RefreshCw, CheckCircle, Clock, XCircle, Package, Download } from 'lucide-react'

type DCItem = {
  _id: string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
    status?: string
  }
  dcOrderId?: {
    _id: string
    school_name?: string
    school_type?: string
    contact_person?: string
    contact_mobile?: string
    email?: string
    address?: string
    location?: string
    zone?: string
    dc_code?: string
  }
  employeeId?: {
    _id: string
    name?: string
    email?: string
  }
  customerName: string
  customerPhone: string
  customerEmail?: string
  customerAddress?: string
  product: string
  requestedQuantity: number
  availableQuantity: number
  deliverableQuantity: number
  deliveryDate?: string
  status: 'created' | 'po_submitted' | 'sent_to_manager' | 'pending_dc' | 'warehouse_processing' | 'completed' | 'hold'
  poPhotoUrl?: string
  poDocument?: string
  productDetails?: Array<{
    product?: string
    productName?: string
    quantity?: number
    price?: number
    total?: number
  }>
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  transport?: string
  lrNo?: string
  lrDate?: string
  deliveryStatus?: 'Pending' | 'In Transit' | 'Delivered' | 'Completed'
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}

export default function DCReportPage() {
  const [dcs, setDcs] = useState<DCItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    loadDCs()
  }, [])

  const loadDCs = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      const response = await apiRequest<any>(`/dc${qs.toString() ? `?${qs.toString()}` : ''}`)
      const dcData = Array.isArray(response) ? response : (response?.data || [])
      setDcs(dcData)
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load DC data',
        variant: 'destructive'
      })
      setDcs([])
    } finally {
      setLoading(false)
    }
  }

  // Filter DCs
  const filteredDCs = useMemo(() => {
    let filtered = dcs

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(dc => dc.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      
      if (dateFilter === 'today') {
        filtered = filtered.filter(dc => {
          const dcDate = dc.dcDate ? new Date(dc.dcDate) : (dc.createdAt ? new Date(dc.createdAt) : null)
          if (!dcDate) return false
          return dcDate >= today
        })
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        filtered = filtered.filter(dc => {
          const dcDate = dc.dcDate ? new Date(dc.dcDate) : (dc.createdAt ? new Date(dc.createdAt) : null)
          if (!dcDate) return false
          return dcDate >= weekAgo
        })
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        filtered = filtered.filter(dc => {
          const dcDate = dc.dcDate ? new Date(dc.dcDate) : (dc.createdAt ? new Date(dc.createdAt) : null)
          if (!dcDate) return false
          return dcDate >= monthAgo
        })
      }
    }

    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter(dc => {
        const dcDate = dc.dcDate ? new Date(dc.dcDate) : (dc.createdAt ? new Date(dc.createdAt) : null)
        return dcDate ? dcDate >= from : false
      })
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter(dc => {
        const dcDate = dc.dcDate ? new Date(dc.dcDate) : (dc.createdAt ? new Date(dc.createdAt) : null)
        return dcDate ? dcDate <= to : false
      })
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(dc => 
        dc.customerName?.toLowerCase().includes(search) ||
        dc.customerPhone?.toLowerCase().includes(search) ||
        dc.product?.toLowerCase().includes(search) ||
        dc.dcOrderId?.school_name?.toLowerCase().includes(search) ||
        dc.dcOrderId?.contact_mobile?.toLowerCase().includes(search) ||
        dc.dcOrderId?.dc_code?.toLowerCase().includes(search) ||
        dc.lrNo?.toLowerCase().includes(search)
      )
    }

    // Hide dummy/test schools whose names stretch report columns
    filtered = filtered.filter((dc) => {
      const name = (dc.dcOrderId?.school_name || dc.customerName || '').trim()
      if (!name) return true
      if (/ABCDEFGHIJKLMNOPQRSTUVWXYZ/i.test(name)) return false
      if (/@{3,}|#{2,}|\$\$/.test(name)) return false
      return true
    })

    return filtered
  }, [dcs, statusFilter, dateFilter, searchTerm, fromDate, toDate])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = filteredDCs.length
    const completed = filteredDCs.filter(dc => dc.status === 'completed').length
    const pending = filteredDCs.filter(dc => 
      dc.status === 'created' || 
      dc.status === 'po_submitted' || 
      dc.status === 'sent_to_manager' || 
      dc.status === 'pending_dc' ||
      dc.status === 'warehouse_processing'
    ).length
    const hold = filteredDCs.filter(dc => dc.status === 'hold').length
    const totalQuantity = filteredDCs.reduce((sum, dc) => sum + (dc.deliverableQuantity || dc.requestedQuantity || 0), 0)
    const totalValue = filteredDCs.reduce((sum, dc) => {
      if (dc.productDetails && dc.productDetails.length > 0) {
        return sum + dc.productDetails.reduce((detailSum, detail) => detailSum + (detail.total || 0), 0)
      }
      return sum
    }, 0)

    return {
      total,
      completed,
      pending,
      hold,
      totalQuantity,
      totalValue
    }
  }, [filteredDCs])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        )
      case 'warehouse_processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Package className="w-3 h-3" />
            Processing
          </span>
        )
      case 'pending_dc':
      case 'sent_to_manager':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
      case 'po_submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Clock className="w-3 h-3" />
            PO Submitted
          </span>
        )
      case 'hold':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            On Hold
          </span>
        )
      case 'created':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <Clock className="w-3 h-3" />
            Created
          </span>
        )
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  const getCustomerName = (dc: DCItem) => {
    if (dc.dcOrderId?.school_name) {
      return dc.dcOrderId.school_name
    }
    return dc.customerName || '-'
  }

  const getContactInfo = (dc: DCItem) => {
    if (dc.dcOrderId?.contact_mobile) {
      return dc.dcOrderId.contact_mobile
    }
    return dc.customerPhone || '-'
  }

  const getLocation = (dc: DCItem) => {
    if (dc.dcOrderId?.location) {
      return dc.dcOrderId.location
    }
    if (dc.dcOrderId?.zone) {
      return dc.dcOrderId.zone
    }
    return dc.customerAddress || '-'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
          <Truck className="w-8 h-8 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">DC Report</h1>
          <p className="text-sm text-neutral-600 mt-1">View and manage delivery challans</p>
        </div>
        </div>
        <Button
          onClick={async () => {
            try {
              const qs = new URLSearchParams()
              if (statusFilter !== 'all') qs.set('status', statusFilter)
              if (fromDate) qs.set('fromDate', fromDate)
              if (toDate) qs.set('toDate', toDate)
              await downloadReportFile(`/reports/dc/export?${qs.toString()}`, 'DC_Report.xlsx')
              toast({ title: 'Excel file downloaded' })
            } catch (error: any) {
              toast({ title: 'Error', description: error.message || 'Export failed', variant: 'destructive' })
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-700 font-medium">Total DCs</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">{summary.total}</p>
            </div>
            <Truck className="w-8 h-8 text-indigo-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Completed</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{summary.completed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{summary.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">On Hold</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{summary.hold}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Additional Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Total Quantity</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {summary.totalQuantity.toLocaleString('en-IN')}
              </p>
            </div>
            <Package className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Value</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                ₹{summary.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Search DCs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="po_submitted">PO Submitted</SelectItem>
              <SelectItem value="sent_to_manager">Sent to Manager</SelectItem>
              <SelectItem value="pending_dc">Pending DC</SelectItem>
              <SelectItem value="warehouse_processing">Warehouse Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="hold">On Hold</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">DC From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">DC To</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <Button onClick={loadDCs} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* DC Table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Delivery Challans ({filteredDCs.length})</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px] table-fixed">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 pr-4 font-semibold w-14">S.No</th>
                <th className="py-3 pr-4 font-semibold w-44">Customer/School</th>
                <th className="py-3 pr-4 font-semibold w-32">Contact</th>
                <th className="py-3 pr-4 font-semibold w-36">Location</th>
                <th className="py-3 pr-4 font-semibold w-36">Product</th>
                <th className="py-3 pr-4 font-semibold w-28">Requested Qty</th>
                <th className="py-3 pr-4 font-semibold w-28">Available Qty</th>
                <th className="py-3 pr-4 font-semibold w-28">Deliverable Qty</th>
                <th className="py-3 pr-4 font-semibold w-32">DC Code</th>
                <th className="py-3 pr-4 font-semibold w-36">Employee</th>
                <th className="py-3 pr-4 font-semibold w-32">Status</th>
                <th className="py-3 pr-4 font-semibold w-28">DC Date</th>
                <th className="py-3 pr-4 font-semibold w-28">LR No</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-muted-foreground">
                    Loading DC data...
                  </td>
                </tr>
              ) : filteredDCs.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-muted-foreground">
                    No DCs found
                  </td>
                </tr>
              ) : (
                filteredDCs.map((dc, index) => {
                  const customerName = getCustomerName(dc)
                  const contact = getContactInfo(dc)
                  const location = getLocation(dc)
                  return (
                  <tr key={dc._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 pr-4 text-muted-foreground">{index + 1}</td>
                    <td className="py-3 pr-4 font-medium truncate" title={customerName}>{customerName}</td>
                    <td className="py-3 pr-4 truncate" title={contact}>{contact}</td>
                    <td className="py-3 pr-4 truncate" title={location}>{location}</td>
                    <td className="py-3 pr-4 truncate" title={dc.product || '-'}>{dc.product || '-'}</td>
                    <td className="py-3 pr-4">{dc.requestedQuantity?.toLocaleString('en-IN') || '-'}</td>
                    <td className="py-3 pr-4">{dc.availableQuantity?.toLocaleString('en-IN') || '-'}</td>
                    <td className="py-3 pr-4 font-medium">{dc.deliverableQuantity?.toLocaleString('en-IN') || '-'}</td>
                    <td className="py-3 pr-4 text-muted-foreground truncate">{dc.dcOrderId?.dc_code || '-'}</td>
                    <td className="py-3 pr-4 truncate" title={dc.employeeId?.name || '-'}>{dc.employeeId?.name || '-'}</td>
                    <td className="py-3 pr-4">{getStatusBadge(dc.status)}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {dc.dcDate 
                        ? new Date(dc.dcDate).toLocaleDateString('en-IN')
                        : (dc.createdAt ? new Date(dc.createdAt).toLocaleDateString('en-IN') : '-')
                      }
                    </td>
                    <td className="py-3 pr-4 truncate">{dc.lrNo || '-'}</td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

