'use client'

import { usePermissions } from './PermissionsProvider'
import { canAccessPath } from '@/lib/access'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter, usePathname } from 'next/navigation'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, rbacActive, permissionsReady, noModuleAccess, isSuperAdmin } = usePermissions()

  if (!permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-neutral-500 text-sm">
        Loading permissions…
      </div>
    )
  }

  const denied =
    rbacActive && pathname ? !canAccessPath(user, pathname) : false

  if (noModuleAccess && pathname === '/dashboard' && !isSuperAdmin) {
    return (
      <Card className="p-8 max-w-lg mx-auto mt-12 text-center space-y-4">
        <h2 className="text-xl font-semibold text-neutral-900">No modules assigned</h2>
        <p className="text-neutral-600">
          Your account has no permissions configured. Contact your administrator to assign access.
        </p>
        <Button variant="outline" onClick={() => router.push('/auth/login')}>
          Sign out
        </Button>
      </Card>
    )
  }

  if (denied) {
    return (
      <Card className="p-8 max-w-lg mx-auto mt-12 text-center space-y-4">
        <h2 className="text-xl font-semibold text-neutral-900">Access denied</h2>
        <p className="text-neutral-600">You do not have permission to view this page.</p>
        <p className="text-xs text-neutral-500">
          If your role was just updated, sign out and sign in again to refresh access.
        </p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </Card>
    )
  }

  return <>{children}</>
}
