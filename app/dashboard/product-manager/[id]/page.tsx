'use client'

import { useParams } from 'next/navigation'
import ProductManagerDashboard from '@/components/dashboard/ProductManagerDashboard'

export default function ProductManagerByIdPage() {
  const params = useParams()
  return <ProductManagerDashboard managerId={String(params.id || '')} />
}
