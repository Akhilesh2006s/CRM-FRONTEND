'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type InventoryRow = {
  id: string
  product: string
  category: string
  level: string
  itemType: string
}

const DEFAULT_INVENTORY_DATA: InventoryRow[] = [
  { id: '1', product: 'Abacus', category: 'STAR JUNIOR', level: 'LEVEL-1', itemType: 'Books' },
  { id: '2', product: 'Abacus', category: 'STAR JUNIOR', level: 'LEVEL-2', itemType: 'Books' },
  { id: '3', product: 'Abacus', category: 'STAR JUNIOR', level: 'LEVEL-3', itemType: 'Books' },
  { id: '4', product: 'Abacus', category: 'STAR JUNIOR', level: 'LEVEL-4', itemType: 'Books' },
  { id: '5', product: 'Abacus', category: 'JUNIOR', level: 'LEVEL-1', itemType: 'Books' },
  { id: '6', product: 'Abacus', category: 'JUNIOR', level: 'LEVEL-2', itemType: 'Books' },
  { id: '7', product: 'Abacus', category: 'JUNIOR', level: 'LEVEL-3', itemType: 'Books' },
  { id: '8', product: 'Abacus', category: 'JUNIOR', level: 'LEVEL-4', itemType: 'Books' },
  { id: '9', product: 'Abacus', category: 'SENIOR', level: 'LEVEL-1', itemType: 'Books' },
  { id: '10', product: 'Abacus', category: 'SENIOR', level: 'LEVEL-2', itemType: 'Books' },
  { id: '11', product: 'Abacus', category: 'SENIOR', level: 'LEVEL-3', itemType: 'Books' },
  { id: '12', product: 'Abacus', category: 'SENIOR', level: 'LEVEL-4', itemType: 'Books' },
]

export default function WarehousePage() {
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [rows] = useState<InventoryRow[]>(DEFAULT_INVENTORY_DATA)

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const mCat = !category || r.category.toLowerCase().includes(category.toLowerCase())
      const mLvl = !level || r.level.toLowerCase().includes(level.toLowerCase())
      return mCat && mLvl
    })
  }, [rows, category, level])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Warehouse Inventory</h1>
      </div>

      <Card className="p-4 bg-[#f4f6fb]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold text-[#454c53] mb-1 ml-0.5">Category</div>
            <Input
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#454c53] mb-1 ml-0.5">Level</div>
            <Input
              placeholder="Level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button className="bg-[#2478c3] hover:bg-[#1f6aab]">Search</Button>
          <Link href="/dashboard/warehouse/inventory-items/new">
            <Button className="bg-[#e6532e] hover:bg-[#cc4827]">Add New Item</Button>
          </Link>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="bg-[#eef3f9] px-4 py-3">
          <div className="text-[#454c53] font-semibold">Inventory List</div>
        </div>
        <div className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">S.NO</TableHead>
                <TableHead>PRODUCT</TableHead>
                <TableHead>CATEGORY</TableHead>
                <TableHead>LEVEL</TableHead>
                <TableHead>ITEM TYPE</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item, idx) => (
                <TableRow key={item.id} className="border-b border-[#dde5ed]">
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="text-neutral-900">{item.product}</TableCell>
                  <TableCell className="text-neutral-900">{item.category}</TableCell>
                  <TableCell className="text-neutral-900">{item.level}</TableCell>
                  <TableCell className="text-neutral-900">{item.itemType}</TableCell>
                  <TableCell className="text-right">
                    {/* Placeholder for edit icon */}
                    <span className="text-amber-500">✎</span>
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


