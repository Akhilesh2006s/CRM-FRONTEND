'use client'

import { usePathname } from 'next/navigation'
import { ModulePageShell, type BreadcrumbSegment } from '@/components/dashboard/ModulePageShell'

const SETTINGS_LABELS: Record<string, string> = {
  password: 'Change Password',
  upload: 'App Dashboard Data Upload',
  sms: 'SMS Settings',
  backup: 'DB Backup',
}

function getSettingsPageLabel(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() || ''
  return SETTINGS_LABELS[segment] || 'Settings'
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pageLabel = getSettingsPageLabel(pathname)

  const breadcrumbs: BreadcrumbSegment[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Settings', href: '/dashboard/settings/password' },
    { label: pageLabel },
  ]

  return (
    <ModulePageShell title={pageLabel} breadcrumbs={breadcrumbs}>
      {children}
    </ModulePageShell>
  )
}
