'use client'

import { usePathname } from 'next/navigation'
import { ModulePageShell, type BreadcrumbSegment } from '@/components/dashboard/ModulePageShell'

const REPORT_LABELS: Record<string, string> = {
  'employee-track': 'Employee Tracking Report',
  'contact-queries': 'Contact Enquiries',
}

function getReportPageLabel(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() || ''
  return REPORT_LABELS[segment] || 'Reports'
}

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageLabel = getReportPageLabel(pathname)

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Reports', href: '/dashboard/reports/employee-track' },
    { label: pageLabel },
  ]

  return (
    <ModulePageShell title={pageLabel} breadcrumbs={breadcrumbs}>
      {children}
    </ModulePageShell>
  )
}
