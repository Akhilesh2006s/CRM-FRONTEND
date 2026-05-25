'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import SampleRequestForm from '@/components/samples/SampleRequestForm'

export default function SampleRequestPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">
              Request Sample Products
            </h1>
            <p className="text-sm text-neutral-600 mt-1">
              Request samples for a school — same product &amp; delivery details as My Clients. After
              submit, EMP DC reviews; then DC goes to warehouse.
            </p>
          </div>
        </div>
        <Link href="/dashboard/samples/my">
          <Button variant="outline">My Samples</Button>
        </Link>
      </div>

      <SampleRequestForm />
    </div>
  )
}
