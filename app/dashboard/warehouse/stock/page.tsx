'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { consolidateStockRows, isInventoryListRow, type ConsolidatedStockRow, type StockSourceItem } from '@/lib/warehouseStockList'

function stockAddHref(row: ConsolidatedStockRow): string {
  const q = new URLSearchParams()
  if (row.productName) q.set('productName', row.productName)
  if (row.category) q.set('category', row.category)
  if (row.level) q.set('level', row.level)
  if (row.specs) q.set('specs', row.specs)
  if (row.subject) q.set('subject', row.subject)
  const qs = q.toString()
  return qs ? `/dashboard/warehouse/stock/add?${qs}` : '/dashboard/warehouse/stock/add'
}

export default function WarehouseStock() {
  const [items, setItems] = useState<ConsolidatedStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const inventoryList = await apiRequest<StockSourceItem[]>('/warehouse')
        const visible = (Array.isArray(inventoryList) ? inventoryList : []).filter(isInventoryListRow)
        setItems(consolidateStockRows(visible))
      } catch (_) {
        setItems([])
      }
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      [i.productName, i.category, i.level, i.specs, i.subject]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [items, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inventory Qty List</h1>
          <p className="text-neutral-500">Warehouse • Current stock</p>
        </div>
        <Link href="/dashboard/warehouse/stock/add">
          <Button className="bg-blue-600 hover:bg-blue-700">Add Item Qty</Button>
        </Link>
      </div>

      <Card className="p-4 md:p-6 rounded-xl border border-neutral-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm text-neutral-600">Search</div>
          <Input
            className="max-w-xs"
            placeholder="Search by product, category, level, specs, subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.No</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Product Category</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Specs</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">No items found.</TableCell>
                </TableRow>
              )}
              {filtered.map((row, idx) => (
                <TableRow key={row._id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium text-neutral-900">{row.productName}</TableCell>
                  <TableCell>{row.category || '-'}</TableCell>
                  <TableCell>{row.level || '-'}</TableCell>
                  <TableCell>{row.specs || '-'}</TableCell>
                  <TableCell>{row.subject || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    {row.currentStock !== undefined && row.currentStock !== null ? row.currentStock : 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={stockAddHref(row)}>
                      <Button variant="destructive" size="sm" className="bg-red-600 hover:bg-red-700">
                        Add Item Qty
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
