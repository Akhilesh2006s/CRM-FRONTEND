'use client'

import { useParams } from 'next/navigation'
import HierarchyDashboard from '@/components/dashboard/HierarchyDashboard'

export default function RegionalManagerDashboardPage() {
  const params = useParams()
  return <HierarchyDashboard level="regional-manager" personId={String(params.id || '')} />
}
