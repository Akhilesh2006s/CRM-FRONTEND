'use client'

import { useParams } from 'next/navigation'
import HierarchyDashboard from '@/components/dashboard/HierarchyDashboard'

export default function RegionalHeadDashboardPage() {
  const params = useParams()
  return <HierarchyDashboard level="regional-head" personId={String(params.id || '')} />
}
