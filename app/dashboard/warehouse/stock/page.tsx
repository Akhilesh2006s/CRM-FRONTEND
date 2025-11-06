'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type StockItem = {
  _id: string
  productName: string
  category?: string
  level?: string
  itemType?: string
  currentStock?: number
}

export default function WarehouseStock() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add Qty modal state
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<StockItem | null>(null)
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<StockItem[]>('/warehouse')
        setItems(data)
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load stock')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      [i.productName, i.category, i.level, i.itemType]
        .filter(Boolean)
        .some((v) => v!.toString().toLowerCase().includes(q))
    )
  }, [items, search])

  function openAddQty(item: StockItem) {
    setSelected(item)
    setQty('')
    setOpen(true)
  }

  async function submitAddQty() {
    if (!selected) return
    const amount = parseFloat(qty)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid quantity')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/warehouse/stock', {
        method: 'POST',
        body: JSON.stringify({
          productId: selected._id,
          quantity: amount,
          movementType: 'In',
          reason: 'Manual add',
        }),
      })
      toast.success('Quantity added')
      // refresh list
      const data = await apiRequest<StockItem[]>('/warehouse')
      setItems(data)
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add quantity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inventory Qty List</h1>
          <p className="text-neutral-500">Warehouse • Current stock</p>
        </div>
        <Link href="/dashboard/warehouse/stock/add">
          <Button>Add Item Qty</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-sm text-neutral-600">Search</div>
          <Input className="max-w-xs" placeholder="Search by product, category, level" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">S.No</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Item Type</TableHead>
              <TableHead className="text-right">Available Qty</TableHead>
              <TableHead className="w-32 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-500">No items found.</TableCell>
              </TableRow>
            )}
            {filtered.map((row, idx) => (
              <TableRow key={row._id}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="text-blue-600 hover:underline cursor-default">{row.productName}</TableCell>
                <TableCell>{row.category || '-'}</TableCell>
                <TableCell>{row.level || '-'}</TableCell>
                <TableCell>{row.itemType || '-'}</TableCell>
                <TableCell className="text-right font-medium">{row.currentStock ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/dashboard/warehouse/stock/add?productId=${row._id}`}>
                    <Button variant="destructive">Add Item Qty</Button>
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

