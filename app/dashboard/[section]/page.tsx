'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { SECTION_REDIRECTS } from '@/lib/dashboardLinks'

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
  const router = useRouter()
  const key = (params?.section || '').toString()
  const redirectTo = SECTION_REDIRECTS[key]
  const title = TITLES[key] || 'Module'

  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo)
    }
  }, [redirectTo, router])

  if (redirectTo) {
    return (
      <Card className="p-8">
        <p className="text-neutral-600">Redirecting to {title}…</p>
      </Card>
    )
  }

  return (
    <Card className="bg-neutral-900/70 border border-neutral-800 p-8 backdrop-blur-xl">
      <h1 className="text-2xl text-white font-semibold">{title}</h1>
      <p className="text-neutral-300 mt-2">
        No redirect configured for this section.
      </p>
    </Card>
  )
}
