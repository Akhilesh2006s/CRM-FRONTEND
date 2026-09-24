'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Clusters are managed on the unified Zones & Clusters page. */
export default function ClustersRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/employees/zones')
  }, [router])
  return (
    <div className="p-6 text-sm text-neutral-600">
      Redirecting to Zones & Clusters…
    </div>
  )
}
