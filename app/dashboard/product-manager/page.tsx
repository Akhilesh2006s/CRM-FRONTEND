'use client'

import { useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth'
import ProductManagerDashboard from '@/components/dashboard/ProductManagerDashboard'

export default function MyProductsPage() {
  const [managerId, setManagerId] = useState('')

  useEffect(() => {
    const user = getCurrentUser()
    if (user?._id && user.role === 'Manager') setManagerId(user._id)
  }, [])

  if (!managerId) {
    return <div className="p-6 text-neutral-500">Open this page as a Product Manager.</div>
  }

  return <ProductManagerDashboard managerId={managerId} />
}
