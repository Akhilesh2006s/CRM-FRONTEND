'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Redirect to unified pending leaves approval page */
export default function EmployeesPendingLeavesPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/leaves/pending')
  }, [router])
  return <div className="p-4 text-sm text-neutral-600">Redirecting to pending leaves…</div>
}
