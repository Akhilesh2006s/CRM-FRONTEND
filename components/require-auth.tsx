'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
    if (!token) {
      router.replace('/auth/login')
    } else {
      setReady(true)
    }
  }, [router])

  if (!ready) {
    return <div className="p-4 text-sm text-neutral-600">Checking authentication…</div>
  }

  return <>{children}</>
}








