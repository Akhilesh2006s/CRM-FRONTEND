'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Advance, advanceMoney } from '@/lib/advance'
import { usePermissions } from '@/components/permissions/PermissionsProvider'

/** Dashboard homes where approvers land after login. */
const DASHBOARD_HOMES = new Set(['/dashboard', '/dashboard/product-manager'])

/** "N advance requests are waiting for your approval" banner on the dashboard home. */
export function PendingAdvanceApprovals() {
  const pathname = usePathname()
  const { user, permissionsReady, hasPermission } = usePermissions()
  const [waiting, setWaiting] = useState<Advance[]>([])
  const show = DASHBOARD_HOMES.has(pathname || '') && permissionsReady && !!user
    && !['Vendor', 'Partner', 'Franchise'].includes(user.role || '') && hasPermission('advance.status.page.view')

  useEffect(() => {
    if (!show) return
    let active = true
    apiRequest<Advance[]>('/advances?status=Pending')
      .then((rows) => { if (active) setWaiting(rows.filter((row) => row.canDecide)) })
      .catch(() => { if (active) setWaiting([]) })
    return () => { active = false }
  }, [show])

  if (!show || waiting.length === 0) return null
  const total = waiting.reduce((sum, row) => sum + row.amount, 0)
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
    <div>
      <p className="font-semibold text-amber-900">
        {waiting.length} advance request{waiting.length === 1 ? ' is' : 's are'} waiting for your approval
      </p>
      <p className="text-sm text-amber-800">
        {waiting.slice(0, 3).map((row) => `${row.employeeId?.name || 'Employee'} (${advanceMoney(row.amount)})`).join(', ')}
        {waiting.length > 3 ? ` and ${waiting.length - 3} more` : ''} · Total {advanceMoney(total)}
      </p>
    </div>
    <Link href="/dashboard/advance/status?scope=review" className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
      Review advances
    </Link>
  </div>
}
