'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { Pencil } from 'lucide-react'
import {
  remapAndMergeInventoryRows,
  vendorMapFromApiPayloads,
  type PartnerAssignment,
} from '@/lib/vendorProductAssignment'

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  class?: string
  location?: string
  level?: string
  specs?: string
  subject?: string
  supplier?: string
  currentStock?: number
}

export default function WarehouseInventoryItems() {
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [data, opts, warehouseVendors, partners, products] = await Promise.all([
          apiRequest<WarehouseItem[]>('/warehouse'),
          apiRequest<{ productVendors?: Record<string, string[]> }>('/metadata/inventory-options').catch(() => ({})),
          apiRequest<{ productVendors?: Record<string, string[]> }>('/warehouse/vendors').catch(() => ({})),
          apiRequest<PartnerAssignment[]>('/partners').catch(() => []),
          apiRequest<Array<{ _id?: string; productName?: string }>>('/products').catch(() => []),
        ])
        const vendorMap = vendorMapFromApiPayloads({
          partners,
          productVendors: opts?.productVendors,
          warehouseProductVendors: warehouseVendors?.productVendors,
          products: Array.isArray(products) ? products : [],
        })
        setItems(remapAndMergeInventoryRows(Array.isArray(data) ? data : [], vendorMap))
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  const filtered = useMemo(() => {
    const lcCategory = category.trim().toLowerCase()
    const lcLevel = level.trim().toLowerCase()
    return items.filter((it) => {
      const vendor = String(it.supplier || '').trim()
      if (!vendor || vendor === '-') return false
      const itemLevel = (it.level || it.location || '').toString().toLowerCase()
      const itemCategory = (it.category || '').toString().toLowerCase()
      const catOk = lcCategory ? itemCategory.includes(lcCategory) : true
      const lvlOk = lcLevel ? itemLevel.includes(lcLevel) : true
      return catOk && lvlOk
    })
  }, [items, category, level])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inventory List</h1>
          <p className="text-neutral-500">Warehouse • Products</p>
        </div>
        <Link href="/dashboard/warehouse/inventory-items/new">
          <Button className="bg-blue-600 hover:bg-blue-700">Add New Item</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-sm text-neutral-600 mb-1">Product Category</div>
            <Input placeholder="Product Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-neutral-600 mb-1">Level</div>
            <Input placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} />
          </div>
          <div className="self-end">
            <Button onClick={() => { /* filters already apply live */ }} className="w-full md:w-auto">Search</Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">S.No</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Product Category</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Specs</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-neutral-500">No items found.</TableCell>
              </TableRow>
            )}
            {filtered.map((row, idx) => (
              <TableRow key={row._id}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="font-medium text-neutral-900">{row.productName}</TableCell>
                <TableCell>{row.category || '-'}</TableCell>
                <TableCell>{row.level || row.location || '-'}</TableCell>
                <TableCell>{row.specs || '-'}</TableCell>
                <TableCell>{row.subject || '-'}</TableCell>
                <TableCell>{row.supplier || '-'}</TableCell>
                <TableCell>{row.currentStock !== undefined && row.currentStock !== null ? row.currentStock : 0}</TableCell>
                <TableCell>
                  <Link href={`/dashboard/warehouse/inventory-items/${row._id}`} aria-label="Edit">
                    <Pencil size={16} className="text-neutral-500 hover:text-neutral-700" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

