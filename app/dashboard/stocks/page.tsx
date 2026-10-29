'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Package, AlertTriangle, RefreshCw } from 'lucide-react'
import { apiRequest } from '@/lib/api'

type StockItem = {
  _id: string
  productName: string
  productCode: string
  availableQuantity: number
  reservedQuantity: number
  minStock: number
  status: string
  lastUpdated: string | null
  isLowStock: boolean
}

export default function VendorStocksPage() {
  const router = useRouter()
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const user = getCurrentUser()

  useEffect(() => {
    if (user?.role !== 'Vendor') {
      router.replace('/dashboard')
      return
    }

    let mounted = true
    const fetchStocks = async () => {
      try {
        const data = await apiRequest<StockItem[]>('/vendor-user/stocks')
        if (mounted) setStocks(Array.isArray(data) ? data : [])
      } catch (e) {
        if (mounted) setError((e as Error)?.message || 'Failed to load stocks')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchStocks()
    return () => { mounted = false }
  }, [user?.role, router])

  if (user?.role !== 'Vendor') {
    return null
  }

  const lowStockCount = stocks.filter((s) => s.isLowStock).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Stocks</h1>
        <p className="text-sm text-neutral-600 mt-1">Current available stock for your assigned products</p>
      </div>

      {loading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-neutral-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Loading stocks...
          </div>
        </Card>
      ) : error ? (
        <Card className="p-8 text-center">
          <p className="text-red-600">{error}</p>
        </Card>
      ) : (
        <>
          {lowStockCount > 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-medium text-amber-800">
                {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} below minimum stock level
              </p>
            </Card>
          )}

          <Card>
            {stocks.length === 0 ? (
              <div className="p-8 text-center text-neutral-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
                <p>No stock data for your assigned products yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Product Code</TableHead>
                      <TableHead className="text-right">Available Qty</TableHead>
                      <TableHead className="text-right">Reserved Qty</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stocks.map((item) => (
                      <TableRow
                        key={item._id}
                        className={item.isLowStock ? 'bg-amber-50/50' : ''}
                      >
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {item.productName}
                            {item.isLowStock && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                Low
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-neutral-600">{item.productCode}</TableCell>
                        <TableCell className="text-right font-medium">{item.availableQuantity}</TableCell>
                        <TableCell className="text-right">{item.reservedQuantity}</TableCell>
                        <TableCell className="text-neutral-600">
                          {item.lastUpdated
                            ? new Date(item.lastUpdated).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              item.status === 'Out of Stock'
                                ? 'bg-red-100 text-red-800'
                                : item.status === 'Low Stock'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.status || 'In Stock'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Optional: Stock level bar chart */}
          {stocks.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-neutral-900 mb-4">Stock Levels by Product</h3>
              <div className="space-y-3">
                {stocks.map((item) => {
                  const maxVal = Math.max(...stocks.map((s) => s.availableQuantity), 1)
                  const pct = maxVal > 0 ? Math.min(100, (item.availableQuantity / maxVal) * 100) : 0
                  return (
                    <div key={item._id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium truncate max-w-[200px]" title={item.productName}>
                          {item.productName}
                        </span>
                        <span className={item.isLowStock ? 'text-amber-600 font-medium' : 'text-neutral-600'}>
                          {item.availableQuantity}
                        </span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
