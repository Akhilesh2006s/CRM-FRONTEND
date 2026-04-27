'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy URL — renewal flow lives at /dashboard/leads/renewal */
export default function LegacyRenewalAddRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/leads/renewal')
  }, [router])
  return (
    <div className="p-8 text-center text-neutral-600 text-sm">
      Redirecting to Renewal Leads…
    </div>
  )
}
