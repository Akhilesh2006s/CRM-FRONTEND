'use client'

import { useRouter } from 'next/navigation'
import { PjpEditor } from '@/components/pjp/PjpEditor'

export default function NewPjpPage() {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">New PJP</h1>
        <p className="text-sm text-neutral-600">Date, school, location, visit purpose and time for each planned visit.</p>
      </div>
      <PjpEditor onSaved={(p) => router.push(`/dashboard/pjp/${p._id}`)} />
    </div>
  )
}
