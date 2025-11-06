'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Stock Returns</h1>
      <Card className="p-6">
        <div className="text-neutral-700">Choose a section:</div>
        <ul className="list-disc pl-6 mt-2 text-blue-600">
          <li>
            <Link href="/dashboard/warehouse">Warehouse Inventory</Link>
          </li>
          <li>
            <span className="text-neutral-500">Employee Returns (coming soon)</span>
          </li>
          <li>
            <span className="text-neutral-500">Warehouse Returns (coming soon)</span>
          </li>
        </ul>
      </Card>
    </div>
  )
}


