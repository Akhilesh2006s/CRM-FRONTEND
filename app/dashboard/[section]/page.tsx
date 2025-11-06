'use client'

import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'

const TITLES: Record<string, string> = {
  leads: 'Leads',
  sales: 'Sales',
  employees: 'Employees',
  expenses: 'Expenses',
  payments: 'Payments',
  reports: 'Reports',
  training: 'Training',
  warehouse: 'Warehouse',
  dc: 'Delivery Challans',
  inventory: 'Inventory',
}

export default function DashboardSectionPage() {
  const params = useParams<{ section: string }>()
  const key = (params?.section || '').toString()
  const title = TITLES[key] || 'Module'

  return (
    <Card className="bg-neutral-900/70 border border-neutral-800 p-8 backdrop-blur-xl">
      <h1 className="text-2xl text-white font-semibold">{title}</h1>
      <p className="text-neutral-300 mt-2">
        Placeholder route for {title}. I can now port `@screens/{title}Screen.tsx` into this page.
      </p>
    </Card>
  )
}


