'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { downloadReportFile } from '@/lib/reportDownload'
import { Package, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, TrendingDown, Download } from 'lucide-react'

type StockItem = {
  _id: string
  productName: string
  productCode?: string
  category?: string
  level?: string
  itemType?: string
  currentStock: number
  minStock: number
  maxStock?: number
  unitPrice: number
  unit: string
  location?: string
  supplier?: string
  lastRestocked?: string
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Discontinued'
  createdAt?: string
  updatedAt?: string
}

export default function StockReportPage() {
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    loadStocks()
  }, [])

  const loadStocks = async () => {
    setLoading(true)
    try {
      const response = await apiRequest<any>('/warehouse')
      // Handle both array and object responses
      const stockData = Array.isArray(response) ? response : (response?.data || [])
      setStocks(stockData)
    } catch (error: any) {
      console.error('Error loading stocks:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to load stock data',
        variant: 'destructive'
      })
      setStocks([])
    } finally {
      setLoading(false)
    }
  }

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>()
    stocks.forEach(item => {
      if (item.category) cats.add(item.category)
    })
    return Array.from(cats).sort()
  }, [stocks])

  // Filter stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter(item => {
      const matchesSearch = 
        !searchTerm ||
        item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter

      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [stocks, searchTerm, statusFilter, categoryFilter])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const totalItems = filteredStocks.length
    const inStock = filteredStocks.filter(s => s.status === 'In Stock').length
    const lowStock = filteredStocks.filter(s => s.status === 'Low Stock').length
    const outOfStock = filteredStocks.filter(s => s.status === 'Out of Stock').length
    const totalValue = filteredStocks.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0)
    const totalQuantity = filteredStocks.reduce((sum, item) => sum + item.currentStock, 0)

    return {
      totalItems,
      inStock,
      lowStock,
      outOfStock,
      totalValue,
      totalQuantity
    }
  }, [filteredStocks])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            In Stock
          </span>
        )
      case 'Low Stock':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3" />
            Low Stock
          </span>
        )
      case 'Out of Stock':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Out of Stock
          </span>
        )
      case 'Discontinued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <XCircle className="w-3 h-3" />
            Discontinued
          </span>
        )
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
          <Package className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Stock Report</h1>
          <p className="text-sm text-neutral-600 mt-1">View and manage warehouse inventory</p>
        </div>
        </div>
        <Button
          onClick={async () => {
            try {
              await downloadReportFile('/reports/stock/export', 'Stock_Report.xlsx')
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
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Total Items</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{summary.totalItems}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">In Stock</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{summary.inStock}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">Low Stock</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{summary.lowStock}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Out of Stock</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{summary.outOfStock}</p>
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
            <TrendingDown className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-700 font-medium">Total Value</p>
              <p className="text-2xl font-bold text-indigo-900 mt-1">
                ₹{summary.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <Package className="w-8 h-8 text-indigo-600 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input
              placeholder="Search products..."
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
              <SelectItem value="In Stock">In Stock</SelectItem>
              <SelectItem value="Low Stock">Low Stock</SelectItem>
              <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              <SelectItem value="Discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={loadStocks} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </Card>

      {/* Stock Table */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Stock Items ({filteredStocks.length})</h2>
          {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 pr-4 font-semibold">Product Name</th>
                <th className="py-3 pr-4 font-semibold">Code</th>
                <th className="py-3 pr-4 font-semibold">Category</th>
                <th className="py-3 pr-4 font-semibold">Current Stock</th>
                <th className="py-3 pr-4 font-semibold">Min Stock</th>
                <th className="py-3 pr-4 font-semibold">Max Stock</th>
                <th className="py-3 pr-4 font-semibold">Unit Price</th>
                <th className="py-3 pr-4 font-semibold">Total Value</th>
                <th className="py-3 pr-4 font-semibold">Location</th>
                <th className="py-3 pr-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    Loading stock data...
                  </td>
                </tr>
              ) : filteredStocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    No stock items found
                  </td>
                </tr>
              ) : (
                filteredStocks.map((item) => (
                  <tr key={item._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium">{item.productName || '-'}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{item.productCode || '-'}</td>
                    <td className="py-3 pr-4">{item.category || '-'}</td>
                    <td className="py-3 pr-4">
                      <span className="font-medium">{item.currentStock.toLocaleString('en-IN')}</span>
                      <span className="text-muted-foreground ml-1">{item.unit}</span>
                    </td>
                    <td className="py-3 pr-4">{item.minStock?.toLocaleString('en-IN') || '-'}</td>
                    <td className="py-3 pr-4">{item.maxStock?.toLocaleString('en-IN') || '-'}</td>
                    <td className="py-3 pr-4">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="py-3 pr-4 font-medium">
                      ₹{(item.currentStock * item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 pr-4">{item.location || '-'}</td>
                    <td className="py-3 pr-4">{getStatusBadge(item.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

