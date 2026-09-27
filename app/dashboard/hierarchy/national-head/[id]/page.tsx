'use client'

import { useParams } from 'next/navigation'
import HierarchyDashboard from '@/components/dashboard/HierarchyDashboard'

export default function NationalHeadDashboardPage() {
  const params = useParams()
  return <HierarchyDashboard level="national-head" personId={String(params.id || '')} />
}
