'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ItemsRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/dashboard/warehouse/inventory-items')
  }, [router])
  
  return null
}

