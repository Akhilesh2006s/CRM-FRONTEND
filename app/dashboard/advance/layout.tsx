'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { canAccessHref } from '@/lib/access'

const pages = [['request', 'Request Advance'], ['status', 'Advance Status'], ['history', 'Advance History'], ['approvals', 'Advance Approvals']]

export default function AdvanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = usePermissions()
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-neutral-900">Advance</h1><p className="mt-1 text-sm text-neutral-500">Request funds, track approvals, and follow your balance.</p></div>
    <nav aria-label="Advance submodules" className="flex flex-wrap gap-2 border-b pb-3">
      {pages.filter(([path]) => canAccessHref(user, `/dashboard/advance/${path}`)).map(([path, label]) => <Link key={path} href={`/dashboard/advance/${path}`} aria-current={pathname.endsWith(path) ? 'page' : undefined}
        className={`rounded-md px-4 py-2 text-sm font-medium ${pathname.endsWith(path) ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-100'}`}>{label}</Link>)}
    </nav>
    {children}
  </div>
}
