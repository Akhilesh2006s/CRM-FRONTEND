'use client'

import { Card } from '@/components/ui/card'

export default function PricingKbPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pricing Policy KB</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Knowledge base for discount bands, approval rules, and reasons (e.g. KB-LAKSHMI-HYUN-PRICING-001) referenced
          in WCX After Discounting.
        </p>
      </div>

      <Card className="p-6">
        <p className="text-sm text-neutral-600">
          Pricing Policy KB placeholder. This screen is now DMS-specific; once you provide the KB sheet, we can display
          versions, rules, and link them to each VIN exposure row.
        </p>
      </Card>
    </div>
  )
}

